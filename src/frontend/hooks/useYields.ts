import { useQuery } from '@tanstack/react-query';
import allowedAssets from '@/lib/allowedAssets.json';
import { targetDefiLlamaChain } from '@/lib/network';
import { ENABLED_SOURCE_PROJECTS, normalizeProject } from '@/lib/protocols';

const DEFILLAMA_API = 'https://yields.llama.fi/pools';

export interface YieldData {
    chain: string;
    project: string;
    symbol: string;
    tvlUsd: number;
    apy: number;
    apyBase: number;
    apyReward: number;
    apyBaseBorrow?: number;
    apyRewardBorrow?: number;
    totalSupplyUsd?: number;
    totalBorrowUsd?: number;
    ltv?: number;
    pool: string;
    underlyingTokens?: string[];
    sourceProject?: string;
}

// Minimal normalization
const NORMALIZE_SYMBOL: Record<string, string> = {
    'WETH': 'ETH',
    // 'WBTC': 'BTC', // Keep WBTC as WBTC
    // 'WBTC': 'BTC'
};

async function fetchYields() {
    const response = await fetch(DEFILLAMA_API);
    const data = await response.json();
    return data.data as YieldData[];
}

const ALLOWED_POOL_IDS = new Set<string>();
Object.values(allowedAssets).forEach((assets: any[]) => {
    assets.forEach(asset => ALLOWED_POOL_IDS.add(asset.poolId));
});

export function useYields() {
    return useQuery({
        queryKey: ['yields', targetDefiLlamaChain],
        queryFn: fetchYields,
        select: (data) => {
            // Filter relevant chain + protocol set first
            const filtered = data.filter(pool => {
                const isTargetChain = pool.chain === targetDefiLlamaChain;
                const isSupportedSourceProject = ENABLED_SOURCE_PROJECTS.has(pool.project);

                if (!isTargetChain || !isSupportedSourceProject) {
                    return false;
                }

                return ALLOWED_POOL_IDS.has(pool.pool) || pool.chain === 'Arbitrum';
            });

            // Aggregate duplicates on normalized project + symbol
            const aggregatedMap = new Map<string, any>();

            filtered.forEach(pool => {
                const symbol = NORMALIZE_SYMBOL[pool.symbol] || pool.symbol;
                const project = normalizeProject(pool.project.includes('aave') ? 'aave' : pool.project);
                const key = `${project}-${symbol}`;

                if (aggregatedMap.has(key)) {
                    const existing = aggregatedMap.get(key);

                    // Weighted Average APY calculation
                    const totalTvl = existing.tvlUsd + pool.tvlUsd;
                    const weightedApy = totalTvl > 0
                        ? (existing.apy * existing.tvlUsd + pool.apy * pool.tvlUsd) / totalTvl
                        : existing.apy;

                    // Weighted Average Borrow APY Logic
                    const existingBorrow = existing.totalBorrowUsd || ((existing.tvlUsd || 0) * 0.4);
                    const poolBorrow = pool.totalBorrowUsd || ((pool.tvlUsd || 0) * 0.4);
                    const totalBorrow = existingBorrow + poolBorrow;


                    const existingBaseBorrow = existing.apyBaseBorrow || (existing.apyBase ? existing.apyBase * 1.5 : 0);
                    const poolBaseBorrow = pool.apyBaseBorrow || (pool.apyBase ? pool.apyBase * 1.5 : 0);

                    const existingRewardBorrow = existing.apyRewardBorrow || 0;
                    const poolRewardBorrow = pool.apyRewardBorrow || 0;

                    const weightedBaseBorrow = totalBorrow > 0
                        ? (existingBaseBorrow * existingBorrow + poolBaseBorrow * poolBorrow) / totalBorrow
                        : existingBaseBorrow;

                    const weightedRewardBorrow = totalBorrow > 0
                        ? (existingRewardBorrow * existingBorrow + poolRewardBorrow * poolBorrow) / totalBorrow
                        : existingRewardBorrow;

                    // Update existing entry
                    existing.tvlUsd += pool.tvlUsd;
                    existing.totalSupplyUsd = (existing.totalSupplyUsd || 0) + (pool.totalSupplyUsd || pool.tvlUsd);
                    existing.totalBorrowUsd = totalBorrow;
                    existing.apy = weightedApy;
                    existing.apyBaseBorrow = weightedBaseBorrow;
                    existing.apyRewardBorrow = weightedRewardBorrow;

                    // Keep max LTV if different (safer to show what's possible, or min? Lets stick to first found for now or max)
                    existing.ltv = Math.max(existing.ltv || 0, pool.ltv || 0);

                } else {
                    // Initialize new entry
                    let fallbackLtv = 0.6;
                    const symbolUpper = symbol.toUpperCase();
                    if (['USDT', 'USDC', 'FDUSD', 'DAI', 'BUSD'].includes(symbolUpper)) {
                        fallbackLtv = 0.8;
                    } else if (['ETH', 'WETH', 'BTC', 'WBTC', 'WBTC', 'SOLVBTC'].includes(symbolUpper)) {
                        fallbackLtv = 0.75;
                    }

                    aggregatedMap.set(key, {
                        ...pool,
                        symbol,
                        project,
                        sourceProject: pool.project,
                        tvlUsd: pool.tvlUsd,
                        apy: pool.apy,
                        apyBaseBorrow: pool.apyBaseBorrow || (pool.apyBase ? pool.apyBase * 1.5 : 0),
                        apyRewardBorrow: pool.apyRewardBorrow || 0,
                        totalSupplyUsd: pool.totalSupplyUsd || pool.tvlUsd,
                        totalBorrowUsd: pool.totalBorrowUsd || (pool.tvlUsd ? pool.tvlUsd * 0.4 : 0),
                        ltv: pool.ltv || fallbackLtv
                    });
                }
            });

            return Array.from(aggregatedMap.values());
        },
    });
}
