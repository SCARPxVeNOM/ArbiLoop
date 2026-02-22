'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';

export interface PortfolioSnapshot {
    timestamp: number;
    netWorthUsd: number;
    totalSupplyUsd: number;
    totalBorrowUsd: number;
    healthFactor: number;
}

const MAX_HISTORY_POINTS = 2500;
const HISTORY_RETENTION_MS = 1000 * 60 * 60 * 24 * 90;
const SNAPSHOT_INTERVAL_MS = 1000 * 60 * 5;
const MIN_NETWORTH_CHANGE_USD = 5;
const MIN_HEALTH_CHANGE = 0.02;

function getStorageKey(walletAddress: string, chainId: number) {
    return `arbiloop.history.${walletAddress.toLowerCase()}.${chainId}`;
}

function readSnapshots(walletAddress: string, chainId: number): PortfolioSnapshot[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(getStorageKey(walletAddress, chainId));
        if (!raw) return [];

        const parsed = JSON.parse(raw) as PortfolioSnapshot[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && typeof item.timestamp === 'number')
            .sort((a, b) => a.timestamp - b.timestamp);
    } catch {
        return [];
    }
}

function writeSnapshots(walletAddress: string, chainId: number, snapshots: PortfolioSnapshot[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getStorageKey(walletAddress, chainId), JSON.stringify(snapshots));
}

interface UsePortfolioHistoryParams {
    totalNetWorthUsd: number;
    totalSupplyUsd: number;
    totalBorrowUsd: number;
    healthFactor: number;
    isEnabled: boolean;
}

export function usePortfolioHistory({
    totalNetWorthUsd,
    totalSupplyUsd,
    totalBorrowUsd,
    healthFactor,
    isEnabled,
}: UsePortfolioHistoryParams) {
    const { address } = useAccount();
    const chainId = useChainId();
    const [history, setHistory] = useState<PortfolioSnapshot[]>([]);

    const isValidPoint = useMemo(() => {
        return (
            Number.isFinite(totalNetWorthUsd) &&
            Number.isFinite(totalSupplyUsd) &&
            Number.isFinite(totalBorrowUsd) &&
            Number.isFinite(healthFactor) &&
            totalNetWorthUsd >= 0 &&
            totalSupplyUsd >= 0 &&
            totalBorrowUsd >= 0
        );
    }, [totalNetWorthUsd, totalSupplyUsd, totalBorrowUsd, healthFactor]);

    const refresh = useCallback(() => {
        if (!address || !isEnabled) {
            setHistory([]);
            return;
        }
        setHistory(readSnapshots(address, chainId));
    }, [address, chainId, isEnabled]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!address || !isEnabled || !isValidPoint) return;

        setHistory((previous) => {
            const now = Date.now();
            const current: PortfolioSnapshot = {
                timestamp: now,
                netWorthUsd: totalNetWorthUsd,
                totalSupplyUsd,
                totalBorrowUsd,
                healthFactor,
            };

            const last = previous[previous.length - 1];
            const shouldAppend =
                !last ||
                now - last.timestamp >= SNAPSHOT_INTERVAL_MS ||
                Math.abs(current.netWorthUsd - last.netWorthUsd) >=
                    Math.max(MIN_NETWORTH_CHANGE_USD, last.netWorthUsd * 0.003) ||
                Math.abs(current.healthFactor - last.healthFactor) >= MIN_HEALTH_CHANGE;

            if (!shouldAppend) return previous;

            const cutoff = now - HISTORY_RETENTION_MS;
            const next = [...previous, current]
                .filter((point) => point.timestamp >= cutoff)
                .slice(-MAX_HISTORY_POINTS);

            writeSnapshots(address, chainId, next);
            return next;
        });
    }, [
        address,
        chainId,
        healthFactor,
        isEnabled,
        isValidPoint,
        totalBorrowUsd,
        totalNetWorthUsd,
        totalSupplyUsd,
    ]);

    return {
        history,
        refresh,
    };
}
