import { useReadContracts, useAccount, useReadContract } from 'wagmi';
import { useMemo } from 'react';
import { formatUnits, parseAbi } from 'viem';
import { useTokenPrices } from './useTokenPrices';
import { KINZA_POOL, RADIANT_LENDING_POOL, AAVE_COMPTROLLER } from '@/lib/pool-config';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const AAVE_COMPTROLLER_ABI = parseAbi([
    'function getAccountLiquidity(address account) view returns (uint256, uint256, uint256)',
    'function getAllMarkets() view returns (address[])',
    'function getAssetsIn(address account) view returns (address[])',
    'function markets(address vToken) view returns (bool, uint256, bool)',
]);

const VTOKEN_ABI = parseAbi([
    'function borrowBalanceStored(address account) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function exchangeRateStored() view returns (uint256)',
    'function symbol() view returns (string)',
]);

const AAVE_ABI = parseAbi([
    'function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
]);

export interface ProtocolHealth {
    healthFactor: number;
    isHealthy: boolean;
    status: 'safe' | 'warning' | 'danger' | 'inactive';
    hasPositions: boolean;
    borrowPowerUSD: number;
    debtUSD: number;
}

export function useAggregatedHealth(targetAddress?: string) {
    const { address: connectedAddress } = useAccount();
    const address = targetAddress || connectedAddress;
    const { data: prices } = useTokenPrices();

    const hasAave = AAVE_COMPTROLLER.toLowerCase() !== ZERO_ADDRESS;
    const hasKinza = KINZA_POOL.toLowerCase() !== ZERO_ADDRESS;
    const hasRadiant = RADIANT_LENDING_POOL.toLowerCase() !== ZERO_ADDRESS;

    const { data: aaveMarkets } = useReadContract({
        address: AAVE_COMPTROLLER,
        abi: AAVE_COMPTROLLER_ABI,
        functionName: 'getAllMarkets',
        query: { enabled: !!address && hasAave }
    });

    const contracts: any[] = [];
    let aaveLiqIndex = -1;
    let aaveAssetsInIndex = -1;
    let kinzaIndex = -1;
    let radiantIndex = -1;
    let aaveMarkersStartIndex = -1;

    if (hasAave) {
        aaveLiqIndex = contracts.push({
            address: AAVE_COMPTROLLER,
            abi: AAVE_COMPTROLLER_ABI,
            functionName: 'getAccountLiquidity',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;

        aaveAssetsInIndex = contracts.push({
            address: AAVE_COMPTROLLER,
            abi: AAVE_COMPTROLLER_ABI,
            functionName: 'getAssetsIn',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;

        if (address && aaveMarkets && (aaveMarkets as string[]).length > 0) {
            aaveMarkersStartIndex = contracts.length;
            (aaveMarkets as string[]).forEach((market) => {
                contracts.push(
                    { address: market as `0x${string}`, abi: VTOKEN_ABI, functionName: 'borrowBalanceStored', args: [address] },
                    { address: market as `0x${string}`, abi: VTOKEN_ABI, functionName: 'balanceOf', args: [address] },
                    { address: market as `0x${string}`, abi: VTOKEN_ABI, functionName: 'exchangeRateStored' },
                    { address: market as `0x${string}`, abi: VTOKEN_ABI, functionName: 'symbol' },
                    { address: AAVE_COMPTROLLER, abi: AAVE_COMPTROLLER_ABI, functionName: 'markets', args: [market as `0x${string}`] },
                );
            });
        }
    }

    if (hasKinza) {
        kinzaIndex = contracts.push({
            address: KINZA_POOL,
            abi: AAVE_ABI,
            functionName: 'getUserAccountData',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;
    }

    if (hasRadiant) {
        radiantIndex = contracts.push({
            address: RADIANT_LENDING_POOL,
            abi: AAVE_ABI,
            functionName: 'getUserAccountData',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;
    }

    const { data, refetch } = useReadContracts({
        contracts,
        query: {
            enabled: !!address && contracts.length > 0,
            refetchInterval: 15000,
        }
    });

    return useMemo(() => {
        const defaultHealth: ProtocolHealth = {
            healthFactor: 0,
            isHealthy: true,
            status: 'inactive',
            hasPositions: false,
            borrowPowerUSD: 0,
            debtUSD: 0
        };

        if (!data || !address || !prices) {
            return {
                aave: defaultHealth,
                kinza: defaultHealth,
                radiant: defaultHealth,
                overallScore: 10,
                totalBorrowPowerUSD: 0,
                totalDebtUSD: 0,
                isLoading: true
            };
        }

        let aave: ProtocolHealth = { ...defaultHealth };
        let kinza: ProtocolHealth = { ...defaultHealth };
        let radiant: ProtocolHealth = { ...defaultHealth };

        if (hasAave && aaveLiqIndex >= 0 && data[aaveLiqIndex]?.status === 'success') {
            const aaveLiqRes = data[aaveLiqIndex];
            const [_, liquidity, shortfall] = aaveLiqRes.result as [bigint, bigint, bigint];
            const liq = parseFloat(formatUnits(liquidity, 18));
            const sf = parseFloat(formatUnits(shortfall, 18));

            const enteredMarkets =
                aaveAssetsInIndex >= 0 && data[aaveAssetsInIndex]?.status === 'success'
                    ? (data[aaveAssetsInIndex].result as string[]).map((market) => market.toLowerCase())
                    : [];

            let totalBorrowUSD = 0;
            let totalBorrowPowerUSD = 0;

            if (aaveMarkets && aaveMarkersStartIndex >= 0) {
                for (let i = 0; i < (aaveMarkets as string[]).length; i++) {
                    const marketAddr = (aaveMarkets as string[])[i].toLowerCase();
                    const baseIdx = aaveMarkersStartIndex + (i * 5);
                    const borRes = data[baseIdx];
                    const balRes = data[baseIdx + 1];
                    const exRes = data[baseIdx + 2];
                    const symRes = data[baseIdx + 3];
                    const mktRes = data[baseIdx + 4];

                    if (borRes?.status === 'success' && symRes?.status === 'success') {
                        const borrowBal = borRes.result as bigint;
                        const vSymbol = symRes.result as string;
                        let symbol = vSymbol.startsWith('v') ? vSymbol.slice(1) : vSymbol;
                        if (symbol === 'BTC') symbol = 'WBTC';
                        if (symbol === 'WETH') symbol = 'ETH';
                        const price = prices.getPrice(symbol);

                        if (borrowBal > 0) {
                            totalBorrowUSD += parseFloat(formatUnits(borrowBal, 18)) * price;
                        }

                        if (
                            enteredMarkets.includes(marketAddr) &&
                            balRes?.status === 'success' &&
                            exRes?.status === 'success' &&
                            mktRes?.status === 'success'
                        ) {
                            const vBal = balRes.result as bigint;
                            const exRate = exRes.result as bigint;
                            const mktInfo = mktRes.result as [boolean, bigint, boolean];
                            const ltv = parseFloat(formatUnits(mktInfo[1], 18));

                            const supplyUnderlying = (vBal * exRate) / BigInt(1e18);
                            const supplyUSD = parseFloat(formatUnits(supplyUnderlying, 18)) * price;
                            totalBorrowPowerUSD += supplyUSD * ltv;
                        }
                    }
                }
            }

            const hasPositions = liq > 0 || sf > 0 || totalBorrowUSD > 0;
            if (hasPositions) {
                let hf = 10;
                if (totalBorrowUSD > 0) {
                    hf = (liq + totalBorrowUSD) / totalBorrowUSD;
                    if (sf > 0) {
                        hf = totalBorrowUSD > 0 ? (totalBorrowUSD - sf) / totalBorrowUSD : 0.5;
                    }
                } else if (liq > 0) {
                    hf = 10;
                }

                aave = {
                    healthFactor: hf,
                    isHealthy: sf === 0 && hf > 1.2,
                    status: sf > 0 ? 'danger' : (hf < 1.3 ? 'warning' : 'safe'),
                    hasPositions,
                    borrowPowerUSD: totalBorrowPowerUSD,
                    debtUSD: totalBorrowUSD
                };
            }
        }

        if (hasKinza && kinzaIndex >= 0 && data[kinzaIndex]?.status === 'success') {
            const result = data[kinzaIndex].result as [bigint, bigint, bigint, bigint, bigint, bigint];
            const totalCollateral = Number(result[0]) / 1e8;
            const totalDebt = Number(result[1]) / 1e8;
            const hfRaw = Number(result[5]) / 1e18;
            const hasPositions = totalCollateral > 0.001 || totalDebt > 0.001;

            if (hasPositions) {
                kinza = {
                    healthFactor: hfRaw,
                    isHealthy: hfRaw > 1.2,
                    status: hfRaw > 1.5 ? 'safe' : (hfRaw > 1.0 ? 'warning' : 'danger'),
                    hasPositions,
                    borrowPowerUSD: Number(result[0]) / 1e8 * (Number(result[4]) / 10000),
                    debtUSD: totalDebt
                };
            }
        }

        if (hasRadiant && radiantIndex >= 0 && data[radiantIndex]?.status === 'success') {
            const result = data[radiantIndex].result as [bigint, bigint, bigint, bigint, bigint, bigint];
            const totalCollateral = Number(result[0]) / 1e8;
            const totalDebt = Number(result[1]) / 1e8;
            const hfRaw = Number(result[5]) / 1e18;
            const hasPositions = totalCollateral > 0.001 || totalDebt > 0.001;

            if (hasPositions) {
                radiant = {
                    healthFactor: hfRaw,
                    isHealthy: hfRaw > 1.2,
                    status: hfRaw > 1.5 ? 'safe' : (hfRaw > 1.0 ? 'warning' : 'danger'),
                    hasPositions,
                    borrowPowerUSD: Number(result[0]) / 1e8 * (Number(result[4]) / 10000),
                    debtUSD: Number(result[1]) / 1e8
                };
            }
        }

        const activeProtocols = [aave, kinza, radiant].filter((protocol) => protocol.hasPositions);
        let overallScore = 10;
        if (activeProtocols.length > 0) {
            const avgHF = activeProtocols.reduce((sum, protocol) => sum + Math.min(2, protocol.healthFactor), 0) / activeProtocols.length;
            overallScore = Math.min(10, Math.max(0, avgHF * 5));
            overallScore = Math.round(overallScore * 10) / 10;
        }

        const totalBorrowPowerUSD = (aave.borrowPowerUSD || 0) + (kinza.borrowPowerUSD || 0) + (radiant.borrowPowerUSD || 0);
        const totalDebtUSD = (aave.debtUSD || 0) + (kinza.debtUSD || 0) + (radiant.debtUSD || 0);

        return {
            aave,
            kinza,
            radiant,
            overallScore,
            totalBorrowPowerUSD,
            totalDebtUSD,
            isLoading: false,
            refetch
        };
    }, [
        data,
        address,
        prices,
        aaveMarkets,
        hasAave,
        hasKinza,
        hasRadiant,
        aaveLiqIndex,
        aaveAssetsInIndex,
        kinzaIndex,
        radiantIndex,
        aaveMarkersStartIndex,
        refetch
    ]);
}

