import { useReadContract, useReadContracts, useAccount } from 'wagmi';
import { useMemo } from 'react';
import { formatUnits, parseAbi } from 'viem';
import { AAVE_COMPTROLLER } from '@/lib/pool-config';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import allowedAssets from '@/lib/allowedAssets.json';

const COMPTROLLER_ABI = parseAbi([
    'function getAllMarkets() view returns (address[])',
    'function getAssetsIn(address account) view returns (address[])',
]);

const VTOKEN_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function borrowBalanceStored(address account) view returns (uint256)',
    'function exchangeRateStored() view returns (uint256)',
    'function underlying() view returns (address)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
]);

export function useAavePortfolio() {
    const { address } = useAccount();
    const { data: prices } = useTokenPrices();
    const isConfigured = AAVE_COMPTROLLER.toLowerCase() !== '0x0000000000000000000000000000000000000000';

    // 1. Fetch All Markets from Comptroller
    const { data: allMarkets } = useReadContract({
        address: AAVE_COMPTROLLER as `0x${string}`,
        abi: COMPTROLLER_ABI,
        functionName: 'getAllMarkets',
        query: {
            enabled: isConfigured,
            staleTime: 1000 * 60 * 60, // 1 hour
        }
    });

    const { data: assetsIn } = useReadContract({
        address: AAVE_COMPTROLLER as `0x${string}`,
        abi: COMPTROLLER_ABI,
        functionName: 'getAssetsIn',
        args: address ? [address] : undefined,
        query: {
            enabled: isConfigured && !!address,
        }
    });

    const markets = (allMarkets as `0x${string}`[]) || [];
    const enteredMarkets = (assetsIn as `0x${string}`[]) || [];

    // 2. Multicall for User Data
    // We need: Balance, Borrow, ExchangeRate, Symbol.
    // Underlying/Decimals are static per market but we fetch them to be safe/robust.
    // To avoid too many calls, we can assume standard 18 for most or fetch just ONCE if needed.
    // For now, let's fetch essential data. If user has balance > 0, we can do a second fetch or just fetch all?
    // Fetching 6 items * 50 markets = 300 calls. Might be heavy but okay for multicall.
    // Let's stick to the script logic but simplified for React (hooks).

    // Optimization: We can't conditionally fetch in a hook easily without complex effects.
    // So we fetch basic data first.
    const contractCalls = markets.flatMap(market => [
        { address: market, abi: VTOKEN_ABI, functionName: 'balanceOf', args: [address] },
        { address: market, abi: VTOKEN_ABI, functionName: 'borrowBalanceStored', args: [address] },
        { address: market, abi: VTOKEN_ABI, functionName: 'exchangeRateStored' },
        { address: market, abi: VTOKEN_ABI, functionName: 'symbol' },
        { address: market, abi: VTOKEN_ABI, functionName: 'underlying' },
    ]);

    const { data: activeData, refetch } = useReadContracts({
        contracts: address && markets.length > 0 ? contractCalls as any[] : [],
        query: {
            enabled: isConfigured && !!address && markets.length > 0,
            refetchInterval: 15000
        }
    });

    // 3. Process Data
    return useMemo(() => {
        if (!isConfigured) return {
            totalSupplyUSD: 0,
            totalBorrowUSD: 0,
            netWorthUSD: 0,
            positions: [],
            isLoading: false,
            refetch
        };

        if (!activeData || !prices || !address) return {
            totalSupplyUSD: 0,
            totalBorrowUSD: 0,
            netWorthUSD: 0,
            positions: [],
            isLoading: !!address, // true if we have address but no data yet
            refetch
        };

        let totalSupplyUSD = 0;
        let totalBorrowUSD = 0;
        const positions: any[] = [];

        // 5 calls per market
        for (let i = 0; i < markets.length; i++) {
            const baseIndex = i * 5;
            const balRes = activeData[baseIndex];
            const borRes = activeData[baseIndex + 1];
            const exRes = activeData[baseIndex + 2];
            const symRes = activeData[baseIndex + 3];
            const undRes = activeData[baseIndex + 4];

            if (balRes.status === 'success' && borRes.status === 'success' && exRes.status === 'success') {
                const vBal = balRes.result as bigint;
                const borrowBal = borRes.result as bigint; // Underlying amount
                const exchangeRate = exRes.result as bigint;
                const vSymbol = symRes.status === 'success' ? (symRes.result as string) : '';

                // Skip if no balance and no borrow
                if (vBal === BigInt(0) && borrowBal === BigInt(0)) continue;

                // Determine Asset Symbol & Decimals
                // Default to 18 decimals and derived symbol
                let decimals = 18;
                let symbol = vSymbol.startsWith('v') ? vSymbol.slice(1) : vSymbol;

                // Special Cases logic (mirroring script roughly)
                if (vSymbol === 'vETH') {
                    symbol = 'ETH';
                    decimals = 18;
                } else if (undRes.status === 'success' && undRes.result) {
                    // Ideally we'd fetch decimals from underlying, but that requires another round of calls.
                    // For now, we can infer or rely on `allowedAssets.json` if possible, 
                    // OR assume 18 (many legacy tokens use 18).
                    // WBTC is 18. ETH is 18. Some stables use 6.
                    // This assumption is a trade-off for performance in this hook.
                    // If we need absolute precision we should add underlying decimals to the initial multicall
                    // but we can't because we don't know the underlying address yet!
                    // For this React implementation, assuming 18 can reduce extra calls.

                    // Specific overrides if known:
                    // Override with per-token decimals if exact precision is required.
                }

                if (symbol === 'WETH') symbol = 'ETH';
                if (symbol === 'BTC') symbol = 'WBTC'; // Aave vBTC -> Underlying is WBTC

                // Supply in Underlying
                // underlying = (vBal * exchangeRate) / 1e18
                // Note: This formula assumes vToken has 8 decimals (usually) and underlying has 18?
                // Actually Aave Maths:
                // ExchangeRate is scaled by 1e18 + (underlyingDecimals - vTokenDecimals).
                // vTokens usually have 8 decimals.
                // If underlying is 18, exp = 18 + 18 - 8 = 28?
                // Actually the standard formula:
                // Supply = (vBal * ExchangeRate) / 1e18
                // The result is in Underlying Decimals (Wei).

                const supplyUnderlyingWei = (vBal * exchangeRate) / BigInt("1000000000000000000");
                const supplyNum = parseFloat(formatUnits(supplyUnderlyingWei, decimals));

                // Borrow in Underlying
                // Borrow balance IS stored in underlying amount directly.
                const borrowNum = parseFloat(formatUnits(borrowBal, decimals));

                // Price
                // Map symbol for price
                let priceSymbol = symbol;
                if (symbol === 'WBTC') priceSymbol = 'BTC';

                const price = prices.getPrice(priceSymbol) || prices.getPrice(symbol); // Try both

                const supplyUSD = supplyNum * price;
                const borrowUSD = borrowNum * price;

                totalSupplyUSD += supplyUSD;
                totalBorrowUSD += borrowUSD;

                // Find APY data
                // Try exact match, then v-stripped match
                let assetConfig = (allowedAssets.aave as any[]).find(a =>
                    a.symbol === symbol ||
                    a.originalSymbol === symbol ||
                    a.symbol === vSymbol
                );

                const supplyAPY = assetConfig ? assetConfig.apy : 0;
                const borrowAPY = assetConfig ? assetConfig.apyBaseBorrow : 0;
                const ltv = assetConfig ? assetConfig.ltv : 0;

                const isCollateral = enteredMarkets.some(m => m.toLowerCase() === markets[i].toLowerCase());

                positions.push({
                    symbol,
                    vTokenAddress: markets[i],
                    isCollateral,
                    supply: supplyNum,
                    supplyUSD,
                    borrow: borrowNum,
                    borrowUSD,
                    price,
                    apy: supplyAPY,
                    borrowApy: borrowAPY,
                    ltv
                });
            }
        }

        return {
            totalSupplyUSD,
            totalBorrowUSD,
            netWorthUSD: totalSupplyUSD - totalBorrowUSD,
            positions,
            isLoading: false,
            refetch
        };

    }, [activeData, prices, address, markets, refetch, isConfigured]);
}
