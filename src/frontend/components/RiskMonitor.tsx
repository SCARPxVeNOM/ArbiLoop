'use client';

import { Card } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAggregatedHealth } from '@/hooks/useAggregatedHealth';

interface RiskMonitorProps {
    healthFactor?: number;
    liquidationThreshold?: number;
    liquidationPrice?: number;
    currentPrice?: number;
    pairName?: string;
    projectedDrop?: number;
    dropLabel?: string;
}

export function RiskMonitor({
    healthFactor,
    liquidationPrice,
    currentPrice,
    pairName = 'Pair',
    projectedDrop,
    dropLabel = 'Projected Move'
}: RiskMonitorProps) {
    const { address } = useAccount();
    const aggregatedHealth = useAggregatedHealth(address);

    const derivedHealthFactor = useMemo(() => {
        if (typeof healthFactor === 'number' && Number.isFinite(healthFactor)) {
            return healthFactor;
        }

        const activeHfValues = [aggregatedHealth.aave, aggregatedHealth.radiant]
            .filter((protocol) => protocol.hasPositions)
            .map((protocol) => protocol.healthFactor)
            .filter((hf) => Number.isFinite(hf) && hf > 0);

        if (activeHfValues.length === 0) return undefined;
        return Math.min(...activeHfValues);
    }, [healthFactor, aggregatedHealth.aave, aggregatedHealth.radiant]);

    const hasLiveHealth = typeof derivedHealthFactor === 'number' && Number.isFinite(derivedHealthFactor) && derivedHealthFactor > 0;
    const hfValue = hasLiveHealth ? derivedHealthFactor : 0;
    const walletConnected = !!address;
    const hasAnyPositions = aggregatedHealth.aave.hasPositions || aggregatedHealth.radiant.hasPositions;

    const isSafe = hasLiveHealth && hfValue > 1.5;
    const isModerate = hasLiveHealth && hfValue > 1.1 && hfValue <= 1.5;

    const statusLabel = !hasLiveHealth
        ? walletConnected
            ? hasAnyPositions
                ? 'Syncing'
                : 'No Position'
            : 'Waiting'
        : isSafe
            ? 'Protected'
            : isModerate
                ? 'Attention'
                : 'Critical';

    const arcStroke = !hasLiveHealth ? '#6b7280' : isSafe ? '#3b82f6' : isModerate ? '#f59e0b' : '#ef4444';
    const arcValue = Math.min(Math.max(hfValue, 0), 3);

    const displayLiqPrice = typeof liquidationPrice === 'number' && Number.isFinite(liquidationPrice)
        ? `$${liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '--';

    const displayCurrentPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice)
        ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '--';

    const autoProjectedDrop = hasLiveHealth && hfValue > 1
        ? -((1 - (1 / hfValue)) * 100)
        : undefined;

    const effectiveProjectedDrop = typeof projectedDrop === 'number' && Number.isFinite(projectedDrop)
        ? projectedDrop
        : autoProjectedDrop;

    const hasProjectedDrop = typeof effectiveProjectedDrop === 'number' && Number.isFinite(effectiveProjectedDrop);

    return (
        <Card className="relative overflow-hidden border-none bg-black/40 backdrop-blur-xl h-full flex flex-col justify-between">
            <div className={`absolute top-0 right-0 p-4 opacity-20 blur-3xl w-32 h-32 rounded-full ${!hasLiveHealth ? 'bg-gray-500' : isSafe ? 'bg-blue-500' : isModerate ? 'bg-amber-500' : 'bg-red-500'}`}></div>

            <div className="p-6 relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-bold font-outfit text-white">Risk Monitor</h3>
                        <p className="text-xs text-muted-foreground">Live health factor monitoring</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${!hasLiveHealth ? 'bg-gray-500/20 text-gray-300' : isSafe ? 'bg-blue-500/20 text-blue-500' : isModerate ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                        {!hasLiveHealth ? <Zap size={12} /> : isSafe ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                        <span>{statusLabel}</span>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center relative my-4">
                    <svg viewBox="0 0 200 120" className="w-full h-32">
                        <path d="M 40 100 A 60 60 0 0 1 160 100" fill="none" stroke="#333" strokeWidth="12" strokeLinecap="round" />
                        <path
                            d="M 40 100 A 60 60 0 0 1 160 100"
                            fill="none"
                            stroke={arcStroke}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray="188.5"
                            strokeDashoffset={188.5 - (arcValue / 3) * 188.5 * 1.5}
                            className="transition-all duration-700 ease-out"
                        />
                    </svg>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                        <div className="text-3xl font-bold font-mono text-white tracking-tighter">
                            {hasLiveHealth ? (hfValue >= 999 ? 'INF' : hfValue.toFixed(2)) : '--'}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${!hasLiveHealth ? 'text-gray-300' : isSafe ? 'text-blue-500' : isModerate ? 'text-amber-500' : 'text-red-500'}`}>
                            {hasLiveHealth ? statusLabel : walletConnected ? 'No Active Loans' : 'Connect Wallet'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Liq. Price</div>
                        <div className="text-lg font-bold text-white">{displayLiqPrice}</div>
                        <div className="text-[10px] text-muted-foreground">{pairName}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">{dropLabel}</div>
                        <div className={`text-lg font-bold ${!hasProjectedDrop ? 'text-white' : Math.abs(effectiveProjectedDrop) > 5 ? 'text-blue-400' : 'text-red-400'}`}>
                            {hasProjectedDrop ? `${effectiveProjectedDrop > 0 ? '+' : ''}${effectiveProjectedDrop.toFixed(2)}%` : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Current: {displayCurrentPrice}</div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
