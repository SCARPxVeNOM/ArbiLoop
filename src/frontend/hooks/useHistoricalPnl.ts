'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId } from 'wagmi';

export interface HistoricalPnlPoint {
    day: string;
    realizedDailyUsd: number;
    cumulativeRealizedUsd: number;
    eventCount: number;
}

export interface HistoricalPnlSummary {
    totalRealizedUsd: number;
    activePrincipalUsd: number;
    totalDepositedUsd: number;
    totalWithdrawnUsd: number;
    trackedAssets: number;
}

export interface HistoricalPnlResponse {
    wallet: string;
    chainId: number;
    days: number;
    points: HistoricalPnlPoint[];
    positions: Array<{
        protocol: string;
        asset_address: string;
        asset_symbol: string;
        principal_usd: number;
        realized_pnl_usd: number;
        total_deposit_usd: number;
        total_withdraw_usd: number;
    }>;
    summary: HistoricalPnlSummary;
    indexed: boolean;
}

interface UseHistoricalPnlParams {
    walletAddress?: `0x${string}`;
    chainIdOverride?: number;
    days: number;
    enabled?: boolean;
}

async function fetchHistoricalPnl(walletAddress: string, chainId: number, days: number): Promise<HistoricalPnlResponse> {
    const params = new URLSearchParams({
        wallet: walletAddress,
        chainId: String(chainId),
        days: String(days),
    });
    const response = await fetch(`/api/pnl/history?${params.toString()}`, {
        cache: 'no-store',
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = typeof body?.error === 'string' ? body.error : 'Failed to fetch historical pnl';
        throw new Error(message);
    }

    return response.json();
}

export function useHistoricalPnl({ walletAddress, chainIdOverride, days, enabled = true }: UseHistoricalPnlParams) {
    const { address } = useAccount();
    const wagmiChainId = useChainId();
    const wallet = walletAddress || address;
    const chainId = chainIdOverride || wagmiChainId || 42161;

    return useQuery({
        queryKey: ['historical-pnl', wallet?.toLowerCase(), chainId, days],
        queryFn: () => fetchHistoricalPnl(wallet as string, chainId, days),
        enabled: Boolean(wallet) && enabled,
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}
