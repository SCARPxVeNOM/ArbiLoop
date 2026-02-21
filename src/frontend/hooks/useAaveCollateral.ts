import { useReadContract, useReadContracts, useAccount } from 'wagmi';
import { useMemo } from 'react';
import { formatUnits } from 'viem';
import {
    AAVE_COMPTROLLER,
    COMPTROLLER_ABI,
    VTOKEN_ABI,
    AAVE_VTOKENS,
} from '@/lib/pool-config';
import { useTokenPrices } from '@/hooks/useTokenPrices';

interface CollateralInfo {
    isCollateral: boolean;
    borrowBalance: number;       // in underlying token
    borrowBalanceUSD: number;
    liquidity: number;           // USD - available to borrow
    shortfall: number;           // USD - if > 0, account is underwater
    maxWithdrawable: number;     // in underlying token (safe to withdraw without shortfall)
    isLoading: boolean;
}

/**
 * Hook to check collateral status for a specific Aave market
 * 
 * @param symbol - The token symbol (e.g. "USDT", "ETH")
 * @returns CollateralInfo with collateral state, borrow balance, and withdrawal limits
 */
export function useAaveCollateral(symbol: string): CollateralInfo {
    const { address } = useAccount();
    const { data: prices } = useTokenPrices();
    const vTokenAddress = AAVE_VTOKENS[symbol];
    const isConfigured = AAVE_COMPTROLLER.toLowerCase() !== '0x0000000000000000000000000000000000000000';

    // 1. Get the list of markets the user has entered as collateral
    const { data: assetsIn } = useReadContract({
        address: AAVE_COMPTROLLER as `0x${string}`,
        abi: COMPTROLLER_ABI,
        functionName: 'getAssetsIn',
        args: address ? [address] : undefined,
        query: {
            enabled: isConfigured && !!address,
            refetchInterval: 10000,
        }
    });

    // 2. Get account liquidity (error, liquidity, shortfall)
    const { data: accountLiquidity } = useReadContract({
        address: AAVE_COMPTROLLER as `0x${string}`,
        abi: COMPTROLLER_ABI,
        functionName: 'getAccountLiquidity',
        args: address ? [address] : undefined,
        query: {
            enabled: isConfigured && !!address,
            refetchInterval: 10000,
        }
    });

    // 3. Get borrow balance + exchange rate + vToken balance for this specific market
    const { data: marketData } = useReadContracts({
        contracts: [
            {
                address: vTokenAddress,
                abi: VTOKEN_ABI,
                functionName: 'borrowBalanceStored',
                args: address ? [address] : undefined,
            },
            {
                address: vTokenAddress,
                abi: VTOKEN_ABI,
                functionName: 'balanceOf',
                args: address ? [address] : undefined,
            },
            {
                address: vTokenAddress,
                abi: VTOKEN_ABI,
                functionName: 'exchangeRateStored',
            },
            {
                // Get collateral factor for this market
                address: AAVE_COMPTROLLER as `0x${string}`,
                abi: COMPTROLLER_ABI,
                functionName: 'markets',
                args: vTokenAddress ? [vTokenAddress] : undefined,
            },
        ],
        query: {
            enabled: isConfigured && !!address && !!vTokenAddress,
            refetchInterval: 10000,
        }
    });

    return useMemo(() => {
        const defaultResult: CollateralInfo = {
            isCollateral: false,
            borrowBalance: 0,
            borrowBalanceUSD: 0,
            liquidity: 0,
            shortfall: 0,
            maxWithdrawable: 0,
            isLoading: true,
        };

        if (!isConfigured) {
            return { ...defaultResult, isLoading: false };
        }

        if (!address || !vTokenAddress || !assetsIn || !accountLiquidity || !marketData) {
            return defaultResult;
        }

        // Check if this vToken is in the user's entered markets
        const enteredMarkets = assetsIn as `0x${string}`[];
        const isCollateral = enteredMarkets.some(
            (m: string) => m.toLowerCase() === vTokenAddress.toLowerCase()
        );

        // Parse liquidity data: [error, liquidity, shortfall]
        const liquidityData = accountLiquidity as [bigint, bigint, bigint];
        const liquidity = parseFloat(formatUnits(liquidityData[1], 18)); // USD scaled by 1e18
        const shortfall = parseFloat(formatUnits(liquidityData[2], 18));

        // Parse borrow balance
        let borrowBalance = 0;
        if (marketData[0].status === 'success') {
            const rawBorrow = marketData[0].result as bigint;
            borrowBalance = parseFloat(formatUnits(rawBorrow, 18)); // Assume 18 decimals
        }

        // Parse supply balance for maxWithdrawable
        let depositedAmount = 0;
        if (marketData[1].status === 'success' && marketData[2].status === 'success') {
            const vBalance = marketData[1].result as bigint;
            const exchangeRate = marketData[2].result as bigint;
            const rawUnderlying = (vBalance * exchangeRate) / BigInt(1e18);
            depositedAmount = parseFloat(formatUnits(rawUnderlying, 18));
        }

        // Get collateral factor
        let collateralFactor = 0;
        if (marketData[3].status === 'success') {
            const marketInfo = marketData[3].result as [boolean, bigint, boolean];
            collateralFactor = parseFloat(formatUnits(marketInfo[1], 18)); // e.g. 0.75
        }

        // Get token price
        let priceSymbol = symbol;
        if (symbol === 'WBTC') priceSymbol = 'BTC';
        const tokenPrice = prices ? (prices.getPrice(priceSymbol) || prices.getPrice(symbol)) : 0;
        const borrowBalanceUSD = borrowBalance * tokenPrice;

        // Calculate maxWithdrawable
        let maxWithdrawable = depositedAmount; // default: can withdraw everything

        if (isCollateral && liquidity > 0 && collateralFactor > 0 && tokenPrice > 0) {
            // Max withdrawable = liquidity / (collateralFactor * tokenPrice)
            // This is how much underlying we can remove while keeping account healthy
            const maxFromLiquidity = liquidity / (collateralFactor * tokenPrice);
            maxWithdrawable = Math.min(depositedAmount, maxFromLiquidity);
        } else if (isCollateral && shortfall > 0) {
            // Already in shortfall, cannot withdraw anything
            maxWithdrawable = 0;
        } else if (isCollateral && borrowBalance > 0 && liquidity === 0) {
            maxWithdrawable = 0;
        }

        return {
            isCollateral,
            borrowBalance,
            borrowBalanceUSD,
            liquidity,
            shortfall,
            maxWithdrawable,
            isLoading: false,
        };
    }, [address, vTokenAddress, assetsIn, accountLiquidity, marketData, prices, symbol, isConfigured]);
}
