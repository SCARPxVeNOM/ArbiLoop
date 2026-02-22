'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Bell, RefreshCw, ShieldCheck, Siren, TriangleAlert } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { supabase } from '@/lib/supabase';
import { useAggregatedHealth } from '@/hooks/useAggregatedHealth';
import { getProtocolLabel } from '@/lib/protocols';
import { targetChainId } from '@/lib/network';

type AlertSeverity = 'info' | 'warning' | 'critical';

type LiveAlertRow = {
    id: number;
    protocol: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    health_factor: number | null;
    threshold: number | null;
    created_at: string;
    wallet_address: string;
};

const POLL_INTERVAL_MS = 20_000;
const MAX_ROWS = 6;

function severityMeta(severity: AlertSeverity) {
    if (severity === 'critical') {
        return {
            box: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
            title: 'text-red-400',
            icon: <Siren className="text-red-500 animate-pulse" size={16} />,
            badge: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
    }
    if (severity === 'warning') {
        return {
            box: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15',
            title: 'text-amber-300',
            icon: <TriangleAlert className="text-amber-400" size={16} />,
            badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        };
    }
    return {
        box: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
        title: 'text-blue-400',
        icon: <ShieldCheck className="text-blue-400" size={16} />,
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
}

function formatRelativeTime(iso: string) {
    const now = Date.now();
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return 'now';
    const deltaSeconds = Math.max(0, Math.floor((now - ts) / 1000));
    if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function LiquidationAlerts() {
    const { address } = useAccount();
    const { aave, radiant, isLoading: healthLoading } = useAggregatedHealth(address);
    const [alerts, setAlerts] = useState<LiveAlertRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const loadAlerts = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('liquidation_alerts')
                .select('id, protocol, severity, title, message, health_factor, threshold, created_at, wallet_address')
                .eq('chain_id', targetChainId)
                .order('created_at', { ascending: false })
                .limit(MAX_ROWS);

            if (address) {
                query = query.eq('wallet_address', address.toLowerCase());
            }

            const { data, error } = await query;
            if (error) throw error;

            setAlerts((data || []) as LiveAlertRow[]);
            setLastUpdated(Date.now());
        } catch (error) {
            console.error('Failed to load liquidation alerts:', error);
            setAlerts([]);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        loadAlerts();
        const timer = setInterval(loadAlerts, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [loadAlerts]);

    const protocolHealthCards = useMemo(() => {
        return [
            { label: getProtocolLabel('aave-v3'), hf: aave.healthFactor, hasPositions: aave.hasPositions },
            { label: getProtocolLabel('radiant-v2'), hf: radiant.healthFactor, hasPositions: radiant.hasPositions },
        ];
    }, [aave.hasPositions, aave.healthFactor, radiant.hasPositions, radiant.healthFactor]);

    return (
        <Card className="w-full bg-[#121216] border border-white/10 shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Bell className="text-[#3B82F6]" size={18} />
                    Live Liquidation Feed
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadAlerts}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                        aria-label="Refresh alerts"
                    >
                        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                        {lastUpdated ? `Updated ${formatRelativeTime(new Date(lastUpdated).toISOString())}` : 'Loading'}
                    </span>
                </div>
            </div>

            {alerts.length > 0 && (
                <div className="space-y-3">
                    {alerts.map((alert) => {
                        const meta = severityMeta(alert.severity);
                        return (
                            <div
                                key={alert.id}
                                className={`flex gap-3 p-3 border rounded-lg group transition-colors ${meta.box}`}
                            >
                                <div className="mt-1">
                                    {meta.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className={`text-sm font-bold ${meta.title}`}>{alert.title}</div>
                                        <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${meta.badge}`}>
                                            {getProtocolLabel(alert.protocol)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {alert.message}
                                    </div>
                                    <div className="text-[10px] font-mono text-white/80 mt-1">
                                        HF: {typeof alert.health_factor === 'number' ? alert.health_factor.toFixed(2) : '--'}
                                        {' '}
                                        | Threshold: {typeof alert.threshold === 'number' ? alert.threshold.toFixed(2) : '--'}
                                        {' '}
                                        | {formatRelativeTime(alert.created_at)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {alerts.length === 0 && (
                <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                        {address
                            ? 'No active liquidation alerts for your wallet right now.'
                            : 'No recent global liquidation alerts yet. Connect wallet to view your feed.'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {protocolHealthCards.map((entry) => {
                            const hf = entry.hf;
                            const healthy = hf > 1.5;
                            const warning = hf > 1.1 && hf <= 1.5;
                            return (
                                <div key={entry.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                    <div className="text-[10px] uppercase text-muted-foreground mb-1">{entry.label}</div>
                                    {!entry.hasPositions ? (
                                        <div className="text-xs text-muted-foreground">{healthLoading ? 'Syncing...' : 'No position'}</div>
                                    ) : (
                                        <div className={`text-sm font-bold ${healthy ? 'text-blue-400' : warning ? 'text-amber-400' : 'text-red-400'}`}>
                                            HF {hf.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>
    );
}
