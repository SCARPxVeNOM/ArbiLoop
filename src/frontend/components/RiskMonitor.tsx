'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

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
    healthFactor: propHealthFactor,
    liquidationThreshold,
    liquidationPrice: propLiqPrice = 485.50,
    currentPrice: propCurrentPrice = 612.30,
    pairName = 'ETH/USD',
    projectedDrop: propDrop = -20.7,
    dropLabel = 'Projected Drop'
}: RiskMonitorProps) {
    // Simulated health factor oscillating slightly (fallback)
    const [simulatedHealth, setSimulatedHealth] = useState(1.45);

    // Use props if available, otherwise simulation
    const healthFactor = propHealthFactor ?? simulatedHealth;

    // Safety thresholds
    const isSafe = healthFactor > 1.5;
    const isModerate = healthFactor > 1.1 && healthFactor <= 1.5;

    // Animate health factor for demo effect if no props
    useEffect(() => {
        if (propHealthFactor !== undefined) return;
        const interval = setInterval(() => {
            setSimulatedHealth(prev => {
                const noise = (Math.random() - 0.5) * 0.05;
                return Math.max(1.0, Math.min(2.0, prev + noise));
            });
        }, 2000);
        return () => clearInterval(interval);
    }, [propHealthFactor]);

    const data = [
        { name: 'Health', value: healthFactor, fill: isSafe ? '#10b981' : isModerate ? '#f59e0b' : '#ef4444' },
    ];

    const cx = 150;
    const cy = 150;
    const iR = 80;
    const oR = 100;
    const value = healthFactor;

    // Calculate angle for needle
    // 1.0 = 180deg (Left), 2.0 = 0deg (Right)
    // Scale: 0 to 3
    const startAngle = 180;
    const endAngle = 0;

    return (
        <Card className="relative overflow-hidden border-none bg-black/40 backdrop-blur-xl h-full flex flex-col justify-between">
            <div className={`absolute top-0 right-0 p-4 opacity-20 blur-3xl w-32 h-32 rounded-full ${isSafe ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-red-500'}`}></div>

            <div className="p-6 relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-bold font-outfit text-white">Risk Monitor</h3>
                        <p className="text-xs text-muted-foreground">Real-time Health Factor tracking</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isSafe ? 'bg-emerald-500/20 text-emerald-500' : isModerate ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                        {isSafe ? <ShieldCheck size={12} /> : isModerate ? <AlertTriangle size={12} /> : <Zap size={12} />}
                        <span>{isSafe ? 'Protected' : isModerate ? 'Attention' : 'Critical'}</span>
                    </div>
                </div>

                {/* Simplified Gauge Visualization using CSS/SVG for cleaner look than Recharts sometimes */}
                <div className="flex-1 flex items-center justify-center relative my-4">
                    {/* Background Arc */}
                    <svg viewBox="0 0 200 120" className="w-full h-32">
                        <path d="M 40 100 A 60 60 0 0 1 160 100" fill="none" stroke="#333" strokeWidth="12" strokeLinecap="round" />
                        {/* Value Arc */}
                        <path
                            d="M 40 100 A 60 60 0 0 1 160 100"
                            fill="none"
                            stroke={isSafe ? '#10b981' : isModerate ? '#f59e0b' : '#ef4444'}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray="188.5"
                            strokeDashoffset={188.5 - (Math.min(healthFactor, 3) / 3) * 188.5 * 1.5} // Rough calibration
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                        <div className="text-3xl font-bold font-mono text-white tracking-tighter">
                            {healthFactor >= 999 ? '∞' : healthFactor.toFixed(2)}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${isSafe ? 'text-emerald-500' : isModerate ? 'text-amber-500' : 'text-red-500'}`}>
                            {isSafe ? 'Safe' : isModerate ? 'Moderate' : 'Critical'}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Liq. Price (Est.)</div>
                        <div className="text-lg font-bold text-white">
                            ${propLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{pairName}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 relative overflow-hidden">
                        {Math.abs(propDrop) < 5 && <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>}
                        <div className="text-[10px] text-muted-foreground uppercase mb-1 relative z-10">{dropLabel}</div>
                        <div className={`text-lg font-bold relative z-10 ${Math.abs(propDrop) > 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {propDrop > 0 ? '+' : ''}{propDrop.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground relative z-10">to Liquidate</div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
