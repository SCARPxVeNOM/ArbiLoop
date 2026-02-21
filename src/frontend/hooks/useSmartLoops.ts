'use client';

import { useMemo } from 'react';
import { useYields, YieldData } from './useYields';

const STABLECOINS = ['USDT', 'USDC', 'FDUSD', 'DAI', 'BUSD', 'TUSD'];
const MAJOR_CRYPTO = ['ETH', 'WETH', 'BTC', 'WBTC'];

export interface SmartLoop {
    id: string;
    supplyAsset: string;
    borrowAsset: string;
    protocol: string;
    protocolDisplay: string;
    netApy: number;
    supplyApy: number;
    borrowApy: number;
    maxLeverage: number;
    leveragedApy: number;
    safetyScore: number;
    risk: 'Low' | 'Medium' | 'High';
    isStable: boolean;
    tvlUsd: number;
    ltv: number;
    pair: string;
}

const PROTOCOL_DISPLAY: Record<string, string> = {
    'aave-v3': 'Aave V3',
    'radiant-v2': 'Radiant',
};

function getAssetSafetyScore(symbol: string, tvl: number): number {
    const symbolUpper = symbol.toUpperCase();

    let volatilityScore = 50;
    if (STABLECOINS.includes(symbolUpper)) {
        volatilityScore = 100;
    } else if (MAJOR_CRYPTO.includes(symbolUpper)) {
        volatilityScore = 80;
    }

    let tvlScore = 0;
    if (tvl > 0) {
        tvlScore = Math.min(100, Math.log10(tvl / 10000) * 25);
    }

    return Math.round(volatilityScore * 0.6 + tvlScore * 0.4);
}

function getRiskLevel(safetyScore: number): 'Low' | 'Medium' | 'High' {
    if (safetyScore >= 75) return 'Low';
    if (safetyScore >= 50) return 'Medium';
    return 'High';
}

function isStablePair(supply: string, borrow: string): boolean {
    return STABLECOINS.includes(supply.toUpperCase()) && STABLECOINS.includes(borrow.toUpperCase());
}

function getMaxLeverage(ltv: number): number {
    if (ltv >= 0.80) return 3;
    if (ltv <= 0) return 1;
    return Math.min(3, 1 / (1 - ltv));
}

function getLeveragedApy(supplyApy: number, borrowApy: number, ltv: number): number {
    const maxLeverage = getMaxLeverage(ltv);
    return supplyApy * maxLeverage - borrowApy * (maxLeverage - 1);
}

export function useSmartLoops() {
    const { data: yields, isLoading, error } = useYields();

    const smartLoops = useMemo(() => {
        if (!yields || yields.length === 0) return [];

        const loops: SmartLoop[] = [];
        const processedPairs = new Set<string>();

        const yieldsByProject: Record<string, YieldData[]> = {};
        yields.forEach((entry) => {
            if (!yieldsByProject[entry.project]) yieldsByProject[entry.project] = [];
            yieldsByProject[entry.project].push(entry);
        });

        Object.entries(yieldsByProject).forEach(([project, projectYields]) => {
            const supplyPools = projectYields.filter((pool) => (pool.apy || 0) > 0);
            const borrowPools = projectYields;

            const sortedBySupply = [...supplyPools].sort((a, b) => (b.apy || 0) - (a.apy || 0));
            const sortedByBorrow = [...borrowPools].sort((a, b) => (a.apyBaseBorrow || 0) - (b.apyBaseBorrow || 0));

            const topSupply = sortedBySupply.slice(0, 10);
            const topBorrow = sortedByBorrow.slice(0, 10);

            topSupply.forEach((supply) => {
                topBorrow.forEach((borrow) => {
                    const pairKey = `${project}-${supply.symbol}-${borrow.symbol}`;
                    if (processedPairs.has(pairKey)) return;
                    processedPairs.add(pairKey);

                    const supplyApy = supply.apy || 0;
                    const borrowApy = borrow.apyBaseBorrow || 0;
                    const ltv = supply.ltv || 0.75;
                    const leveragedApy = getLeveragedApy(supplyApy, borrowApy, ltv);
                    const netApy = supplyApy - borrowApy;

                    if (leveragedApy < 1) return;

                    const supplySafety = getAssetSafetyScore(supply.symbol, supply.tvlUsd);
                    const borrowSafety = getAssetSafetyScore(borrow.symbol, borrow.tvlUsd);
                    const combinedSafety = Math.min(supplySafety, borrowSafety);

                    if (combinedSafety < 30 && Math.min(supply.tvlUsd, borrow.tvlUsd) < 100000) return;

                    const maxLev = getMaxLeverage(ltv);

                    loops.push({
                        id: pairKey,
                        supplyAsset: supply.symbol,
                        borrowAsset: borrow.symbol,
                        protocol: project,
                        protocolDisplay: PROTOCOL_DISPLAY[project] || project,
                        netApy: Math.round(netApy * 10) / 10,
                        supplyApy: Math.round(supplyApy * 10) / 10,
                        borrowApy: Math.round(borrowApy * 10) / 10,
                        maxLeverage: Math.round(maxLev * 10) / 10,
                        leveragedApy: Math.round(leveragedApy * 10) / 10,
                        safetyScore: combinedSafety,
                        risk: getRiskLevel(combinedSafety),
                        isStable: isStablePair(supply.symbol, borrow.symbol),
                        tvlUsd: Math.min(supply.tvlUsd, borrow.tvlUsd),
                        ltv: Math.round(ltv * 100),
                        pair: `${supply.symbol} / ${borrow.symbol}`
                    });
                });
            });
        });

        return loops.sort((a, b) => {
            const scoreA = a.leveragedApy * (a.safetyScore / 100);
            const scoreB = b.leveragedApy * (b.safetyScore / 100);
            return scoreB - scoreA;
        });
    }, [yields]);

    const getTopLoops = (count = 5) => smartLoops.slice(0, count);
    const getStableLoops = () => smartLoops.filter((loop) => loop.isStable);
    const getSafeLoops = () => smartLoops.filter((loop) => loop.risk === 'Low');
    const getByProtocol = (protocol: string) => smartLoops.filter((loop) => loop.protocol.toLowerCase().includes(protocol.toLowerCase()));

    return {
        loops: smartLoops,
        isLoading,
        error,
        getTopLoops,
        getStableLoops,
        getSafeLoops,
        getByProtocol
    };
}

