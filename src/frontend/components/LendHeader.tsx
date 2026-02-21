'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useYields } from "@/hooks/useYields";
import { useAggregatedHealth } from "@/hooks/useAggregatedHealth";
import { motion, useMotionValue, useInView, animate } from 'framer-motion';
import { cn, formatMoney } from '@/lib/utils';
import Image from 'next/image';
import { targetChainName } from '@/lib/network';
import { getProtocolLabel } from '@/lib/protocols';

function Counter({ value, prefix = '', suffix = '' }: { value: number, prefix?: string, suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const isInView = useInView(ref, { once: true, margin: "-10px" });

    useEffect(() => {
        if (isInView) {
            animate(motionValue, value, {
                duration: 1.2, // Max 1.5s as requested
                ease: "easeOut"
            });
        }
    }, [motionValue, isInView, value]);

    useEffect(() => {
        return motionValue.on("change", (latest) => {
            if (ref.current) {
                // Formatting logic inside the animation frame
                let formatted = latest.toFixed(0);
                if (latest >= 1000000000) {
                    formatted = (latest / 1000000000).toFixed(2) + 'B';
                } else if (latest >= 1000000) {
                    formatted = (latest / 1000000).toFixed(2) + 'M';
                } else {
                    formatted = latest.toFixed(2); // For smaller numbers
                }

                // For very large numbers in the billions, we might just want 2 decimal places always if > 1B
                // The prompt example shows $1.69B, so let's stick to that compact format

                ref.current.textContent = `${prefix}${formatted}${suffix}`;
            }
        });
    }, [motionValue, prefix, suffix]);

    return <span ref={ref} />;
}

export function LendHeader() {
    const { data: yields } = useYields();
    const { totalBorrowPowerUSD, totalDebtUSD, aave, kinza, radiant, isLoading } = useAggregatedHealth();

    // The user wants a 5% safety margin: Max Safe = Power * 0.95
    const maxSafeBorrowPower = totalBorrowPowerUSD * 0.95;
    const utilization = maxSafeBorrowPower > 0 ? (totalDebtUSD / maxSafeBorrowPower) * 100 : 0;
    const isUtilizationHigh = utilization > 80;

    const metrics = useMemo(() => {
        if (!yields) return { totalSupply: 0, totalAvailable: 0, totalBorrowed: 0 };

        return yields.reduce((acc, pool) => {
            const supply = pool.totalSupplyUsd || pool.tvlUsd || 0;
            const borrow = pool.totalBorrowUsd || (pool.tvlUsd ? pool.tvlUsd * 0.4 : 0);

            return {
                totalSupply: acc.totalSupply + supply,
                totalBorrowed: acc.totalBorrowed + borrow,
                totalAvailable: acc.totalAvailable + (supply - borrow)
            };
        }, { totalSupply: 0, totalAvailable: 0, totalBorrowed: 0 });
    }, [yields]);

    return (
        <div className="relative w-full rounded-3xl p-[1px] bg-gradient-to-r from-white/10 via-[#CEFF00]/30 to-white/10 mb-4 md:mb-8 overflow-hidden font-outfit shadow-2xl">
            <div className="relative w-full h-full rounded-3xl bg-[#09090b]/80 backdrop-blur-xl p-3 md:p-8 overflow-hidden">
                {/* Background Gradient/Glow */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-[#CEFF00]/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center w-full">
                    {/* Logo/Icon + Title Row */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className="relative w-8 h-8 md:w-12 md:h-12">
                            <Image src="/ArbiLoop.png" alt="ArbiLoop" fill className="object-contain" />
                        </div>

                        <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">
                            <span className="text-white">ArbiLoop</span> <span className="text-[#CEFF00]">Lend</span>
                        </h1>
                    </div>

                    <p className="text-muted-foreground text-sm md:text-[16px] max-w-md mb-6 px-4">
                        The smartest yield intelligence suite on {targetChainName}
                    </p>

                    {/* Divider */}
                    <div className="w-full max-w-lg h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

                    {/* Metrics Grid - Adjusted for mobile */}
                    <div className="grid grid-cols-3 w-full max-w-2xl gap-2 md:gap-8 px-0 md:px-0">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] md:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">
                                Total Supply
                            </span>
                            <div className="text-sm md:text-2xl font-bold text-white tracking-tight">
                                <Counter value={metrics.totalSupply} prefix="$" />
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-[8px] md:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">
                                Available
                            </span>
                            <div className="text-sm md:text-2xl font-bold text-emerald-400 tracking-tight">
                                <Counter value={metrics.totalAvailable} prefix="$" />
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-[8px] md:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">
                                Borrowed
                            </span>
                            <div className="text-sm md:text-2xl font-bold text-blue-400 tracking-tight">
                                <Counter value={metrics.totalBorrowed} prefix="$" />
                            </div>
                        </div>
                    </div>

                    {/* Utilization Bar */}
                    {!isLoading && totalBorrowPowerUSD > 0 && (
                        <div className="w-full max-w-2xl mt-6 md:mt-8 px-2 md:px-0">
                            <div className="flex items-end justify-between mb-2">
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="text-[9px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">Total Borrow Power</span>
                                    <span className="text-sm md:text-xl font-black text-white leading-none">
                                        {formatMoney(maxSafeBorrowPower)}
                                        <span className="text-[8px] md:text-[10px] text-muted-foreground/60 ml-1 font-medium italic">SAFE MAX</span>
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[9px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">Utilization</span>
                                    <span className={cn(
                                        "text-sm md:text-xl font-black leading-none",
                                        isUtilizationHigh ? "text-red-400" : "text-[#CEFF00]"
                                    )}>
                                        {utilization.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                <motion.div
                                    className={cn(
                                        "h-full rounded-full bg-gradient-to-r",
                                        isUtilizationHigh ? "from-red-500 to-orange-500" : "from-[#CEFF00] to-emerald-400"
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(utilization, 100)}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </div>

                            <div className="flex flex-wrap md:flex-nowrap justify-center md:justify-between mt-4 text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground gap-2 md:gap-4">
                                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1.5 rounded-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#F0B90B] shadow-[0_0_8px_rgba(240,185,11,0.5)]" />
                                    <span>{getProtocolLabel('aave')}: <span className="text-white/90">{formatMoney(aave.debtUSD)}</span> / <span className="text-white/60">{formatMoney(aave.borrowPowerUSD * 0.95)}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1.5 rounded-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    <span>{getProtocolLabel('kinza-finance')}: <span className="text-white/90">{formatMoney(kinza.debtUSD)}</span> / <span className="text-white/60">{formatMoney(kinza.borrowPowerUSD * 0.95)}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1.5 rounded-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#A855F7] shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                    <span>{getProtocolLabel('radiant-v2')}: <span className="text-white/90">{formatMoney(radiant.debtUSD)}</span> / <span className="text-white/60">{formatMoney(radiant.borrowPowerUSD * 0.95)}</span></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

