'use client';

import { useMemo } from 'react';
import { useYields, YieldData } from './useYields';

// Asset categories for safety scoring
const STABLECOINS = ['USDT', 'USDC', 'FDUSD', 'DAI', 'BUSD', 'TUSD'];
const MAJOR_CRYPTO = ['ETH', 'WETH', 'ETH', 'WETH', 'BTC', 'WBTC', 'WBTC'];

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

// Protocol display names and normalized keys
const PROTOCOL_DISPLAY: Record<string, string> = {
    'aave': 'Aave',
    'aave-core-pool': 'Aave',
    'aave-isolated-pool': 'Aave',
    'kinza-finance': 'Kinza',
    'aave-v3': 'Aave V3',
    'radiant-v2': 'Radiant'
};

// Normalize protocol name for URL params
const PROTOCOL_NORMALIZE: Record<string, string> = {
    'aave': 'aave',
    'aave-core-pool': 'aave',
    'aave-isolated-pool': 'aave',
    'kinza-finance': 'kinza',
    'aave-v3': 'kinza',
    'radiant-v2': 'radiant'
};

/**
 * Calculate safety score for an asset (0-100)
 */
function getAssetSafetyScore(symbol: string, tvl: number): number {
    const symbolUpper = symbol.toUpperCase();

    // Base volatility score
    let volatilityScore = 50; // Default for altcoins
    if (STABLECOINS.includes(symbolUpper)) {
        volatilityScore = 100;
    } else if (MAJOR_CRYPTO.includes(symbolUpper)) {
        volatilityScore = 80;
    }

    // TVL score (0-100, scaled logarithmically)
    // $100k = 20, $1M = 50, $10M = 80, $100M = 100
    let tvlScore = 0;
    if (tvl > 0) {
        tvlScore = Math.min(100, Math.log10(tvl / 10000) * 25);
    }

    // Combined score
    return Math.round(volatilityScore * 0.6 + tvlScore * 0.4);
}

/**
 * Determine risk level from safety score
 */
function getRiskLevel(safetyScore: number): 'Low' | 'Medium' | 'High' {
    if (safetyScore >= 75) return 'Low';
    if (safetyScore >= 50) return 'Medium';
    return 'High';
}

/**
 * Check if both assets are stablecoins
 */
function isStablePair(supply: string, borrow: string): boolean {
    return STABLECOINS.includes(supply.toUpperCase()) &&
        STABLECOINS.includes(borrow.toUpperCase());
}

/**
 * Calculate max leverage from LTV using geometric series formula
 * MaxLeverage = 1 / (1 - LTV)
 * Example: LTV 75% = 0.75 -> MaxLev = 1 / (1 - 0.75) = 4x
 * Capped at 3x for sensible risk management
 */
function getMaxLeverage(ltv: number): number {
    if (ltv >= 0.80) return 3; // Cap at 3x
    if (ltv <= 0) return 1;
    return Math.min(3, 1 / (1 - ltv));
}

/**
 * Calculate leveraged APY using proper geometric series
 * When you loop with LTV:
 * - Loop 1: Supply $1000, borrow $750 (at 75% LTV), supply again
 * - Loop 2: Supply $750, borrow $562.50, supply again
 * - And so on...
 * 
 * Total effective supply = 1 + LTV + LTV^2 + ... = 1 / (1 - LTV) = MaxLeverage
 * Total borrowed = LTV + LTV^2 + ... = LTV / (1 - LTV) = MaxLeverage - 1
 * 
 * LeveragedAPY = SupplyAPY * MaxLeverage - BorrowAPY * (MaxLeverage - 1)
 */
function getLeveragedApy(supplyApy: number, borrowApy: number, ltv: number): number {
    const maxLeverage = getMaxLeverage(ltv);
    const totalSupplyMultiplier = maxLeverage;
    const totalBorrowMultiplier = maxLeverage - 1;

    return supplyApy * totalSupplyMultiplier - borrowApy * totalBorrowMultiplier;
}

export function useSmartLoops() {
    const { data: yields, isLoading, error } = useYields();

    const smartLoops = useMemo(() => {
        if (!yields || yields.length === 0) return [];

        const loops: SmartLoop[] = [];
        const processedPairs = new Set<string>();

        // Group yields by project for same-protocol loops
        const yieldsByProject: Record<string, YieldData[]> = {};
        yields.forEach(y => {
            const project = y.project.includes('aave') ? 'aave' : y.project;
            if (!yieldsByProject[project]) yieldsByProject[project] = [];
            yieldsByProject[project].push(y);
        });

        // For each project, find optimal supply/borrow pairs
        Object.entries(yieldsByProject).forEach(([project, projectYields]) => {
            const normalizedProject = PROTOCOL_NORMALIZE[project] || project;
            if (normalizedProject === 'aave') return;
            // Filter for pools with positive supply APY for supply candidates
            const supplyPools = projectYields.filter(p => (p.apy || 0) > 0);

            // For borrow, we want low borrow APY - all pools are candidates
            const borrowPools = projectYields;

            // Sort by supply APY descending
            const sortedBySupply = [...supplyPools].sort((a, b) => (b.apy || 0) - (a.apy || 0));

            // Sort by borrow APY ascending (cheapest to borrow)
            const sortedByBorrow = [...borrowPools].sort((a, b) =>
                (a.apyBaseBorrow || 0) - (b.apyBaseBorrow || 0)
            );

            // Generate pairs
            const topSupply = sortedBySupply.slice(0, 10);
            const topBorrow = sortedByBorrow.slice(0, 10);

            topSupply.forEach(supply => {
                topBorrow.forEach(borrow => {
                    const pairKey = `${project}-${supply.symbol}-${borrow.symbol}`;
                    if (processedPairs.has(pairKey)) return;
                    processedPairs.add(pairKey);

                    const supplyApy = supply.apy || 0;
                    const borrowApy = borrow.apyBaseBorrow || 0;
                    const ltv = supply.ltv || 0.75;

                    // Calculate leveraged APY properly
                    const leveragedApy = getLeveragedApy(supplyApy, borrowApy, ltv);
                    const netApy = supplyApy - borrowApy; // Simple 1x net

                    // Skip if leveraged APY is too low or negative
                    if (leveragedApy < 1) return;

                    // Calculate safety based on the riskier asset
                    const supplySafety = getAssetSafetyScore(supply.symbol, supply.tvlUsd);
                    const borrowSafety = getAssetSafetyScore(borrow.symbol, borrow.tvlUsd);
                    const combinedSafety = Math.min(supplySafety, borrowSafety);

                    // Skip very low safety altcoins with low TVL
                    if (combinedSafety < 30 && Math.min(supply.tvlUsd, borrow.tvlUsd) < 100000) return;

                    const maxLev = getMaxLeverage(ltv);

                    loops.push({
                        id: pairKey,
                        supplyAsset: supply.symbol,
                        borrowAsset: borrow.symbol,
                        protocol: PROTOCOL_NORMALIZE[project] || project,
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

        // Sort by a combined score: leveraged APY * safety factor
        return loops.sort((a, b) => {
            const scoreA = a.leveragedApy * (a.safetyScore / 100);
            const scoreB = b.leveragedApy * (b.safetyScore / 100);
            return scoreB - scoreA;
        });

    }, [yields]);

    // Filter functions
    const getTopLoops = (count = 5) => smartLoops.slice(0, count);

    const getStableLoops = () => smartLoops.filter(l => l.isStable);

    const getSafeLoops = () => smartLoops.filter(l => l.risk === 'Low');

    const getByProtocol = (protocol: string) =>
        smartLoops.filter(l => l.protocol.toLowerCase().includes(protocol.toLowerCase()));

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
