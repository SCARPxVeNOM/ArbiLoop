'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Markets } from "@/components/Markets"
import { useAccount } from 'wagmi';
import { useAggregatedHealth } from "@/hooks/useAggregatedHealth";
import { useAavePortfolio } from "@/hooks/useAavePortfolio";
import { useRadiantPortfolio } from "@/hooks/useRadiantPortfolio";
import { useYields } from "@/hooks/useYields";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProtocolIcon, getProtocolLabel } from '@/lib/protocols';
import { MarketModal } from "@/components/MarketModal";

import { AIInsights } from "@/components/AIInsights";
import { PortfolioAnalytics, DashboardPosition } from "@/components/PortfolioAnalytics";

type PortfolioPosition = {
    supplyUSD: number;
    borrowUSD: number;
    apy?: number;
    borrowApy?: number;
};

export function Dashboard() {
    const { address } = useAccount();
    const { data: yields = [] } = useYields();
    const [quickActionModal, setQuickActionModal] = useState<{
        mode: "earn" | "borrow";
        tab: "deposit" | "repay";
        pool: Record<string, unknown>;
    } | null>(null);

    // 2. Fetch Aggregated Health Data
    // We use the connected address directly as the "wallet" for now, or adapt as needed.
    // If the hook expects a specific smart wallet address, and we removed the factory fetch,
    // we should clarify if we just pass `address` or if we need another way.
    // Assuming for now `address` (EOA) or `undefined` is acceptable or that
    // the previous logic was specifically for a smart wallet factory that is now deprecated.
    // If the user says "we don't need contracts", we likely rely on EOA or a different mechanism.
    const healthData = useAggregatedHealth(address);

    // 3. Fetch Portfolio Data
    const aave = useAavePortfolio();
    const radiant = useRadiantPortfolio();

    const isDashboardLoading = healthData.isLoading || aave.isLoading || radiant.isLoading;

    // Financial calculations - Memoized to prevent constant rendering
    const stats = useMemo(() => {
        const calculateNetAPY = (positions: PortfolioPosition[], netWorth: number) => {
            if (netWorth <= 0) return 0;
            let totalAnnualIncome = 0;
            let totalAnnualCost = 0;

            positions.forEach(pos => {
                if (pos.supplyUSD > 0) {
                    totalAnnualIncome += pos.supplyUSD * ((pos.apy || 0) / 100);
                }
                if (pos.borrowUSD > 0) {
                    totalAnnualCost += pos.borrowUSD * ((pos.borrowApy || 0) / 100);
                }
            });

            const netAnnual = totalAnnualIncome - totalAnnualCost;
            return (netAnnual / netWorth) * 100;
        };

        const totalSupplied = aave.totalSupplyUSD + radiant.totalSupplyUSD;
        const totalBorrowed = aave.totalBorrowUSD + radiant.totalBorrowUSD;
        const totalNetWorth = totalSupplied - totalBorrowed;

        const allPositions: DashboardPosition[] = [
            ...(aave.positions || []).map((position: any) => ({ ...position, protocol: 'aave-v3' })),
            ...(radiant.positions || []).map((position: any) => ({ ...position, protocol: 'radiant-v2' })),
        ];

        const globalNetAPY = calculateNetAPY(allPositions, totalNetWorth);
        const aaveNetAPY = calculateNetAPY(aave.positions || [], aave.totalSupplyUSD - aave.totalBorrowUSD);
        const radiantNetAPY = calculateNetAPY(radiant.positions || [], radiant.totalSupplyUSD - radiant.totalBorrowUSD);

        return {
            totalSupplied,
            totalBorrowed,
            totalNetWorth,
            globalNetAPY,
            aaveNetAPY,
            radiantNetAPY,
            allPositions
        };
    }, [aave, radiant]);

    const { totalSupplied, totalBorrowed, totalNetWorth, globalNetAPY, aaveNetAPY, radiantNetAPY, allPositions } = stats;
    const overallHealthFactor = useMemo(() => {
        const activeHealth = [healthData.aave, healthData.radiant]
            .filter((protocol) => protocol.hasPositions)
            .map((protocol) => protocol.healthFactor)
            .filter((value) => Number.isFinite(value) && value > 0);

        if (activeHealth.length === 0) return 10;
        return Math.min(...activeHealth);
    }, [healthData.aave, healthData.radiant]);

    // Prepare data for AI Agent - Memoized to prevent frequent re-renders of AIInsights
    const portfolioForAI = {
        totalNetWorth,
        totalSupplied,
        totalBorrowed,
        globalNetAPY,
        aave: { supply: aave.totalSupplyUSD, borrow: aave.totalBorrowUSD, health: healthData.aave.healthFactor },
        radiant: { supply: radiant.totalSupplyUSD, borrow: radiant.totalBorrowUSD, health: healthData.radiant.healthFactor },
        positions: allPositions
    };

    return (
        <div className="container pt-0 md:pt-8 pb-24 space-y-8 max-w-screen-2xl mx-auto px-4 md:px-16">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 font-outfit bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
                        Dashboard
                    </h1>
                    <div className="text-sm text-muted-foreground">
                        {address ? 'Welcome back, Strategist.' : 'Connect your wallet to view your personalized yields.'}
                    </div>
                </div>
                {address && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#CEFF00]/10 border border-[#CEFF00]/20 text-[#CEFF00] text-xs font-bold uppercase tracking-wider animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-[#CEFF00]" />
                        AI Risk Agent Active
                    </div>
                )}
            </div>

            {/* AI Insights Section - Always rendered, handles its own empty/auth state internally */}
            <AIInsights portfolioData={portfolioForAI} isLoading={isDashboardLoading} />

            {/* Top Stats: Aggregated Financials */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {/* Total Net Worth */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                <span className="text-lg md:text-xl font-black text-emerald-500">$</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Net Worth</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-white leading-none tracking-tight mb-2 md:mb-3 h-[1.2em] flex items-center">
                                {!address ? '$0.00' : isDashboardLoading ? <Skeleton className="h-8 md:h-12 w-32 md:w-48 bg-white/10" /> : `$${totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                            <div className="flex items-center gap-2 h-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-3 w-20 bg-emerald-500/10" />
                                ) : (
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-sm font-black text-emerald-400 leading-none">
                                            {globalNetAPY > 0 ? '+' : ''}{globalNetAPY.toFixed(2)}%
                                        </span>
                                        <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
                                            Net APY
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Supply */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shrink-0">
                                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Supplied</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-emerald-400 leading-none tracking-tight mb-2 md:mb-3 h-[1.2em] flex items-center">
                                {!address ? '$0.00' : isDashboardLoading ? <Skeleton className="h-8 md:h-12 w-32 md:w-48 bg-emerald-400/10" /> : `$${totalSupplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                            <div className="flex items-center gap-2 h-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-3 w-16 bg-emerald-400/10" />
                                ) : (
                                    <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Active</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Debt */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Borrowed</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-red-500 leading-none tracking-tight mb-2 md:mb-3 h-[1.2em] flex items-center">
                                {!address ? '$0.00' : isDashboardLoading ? <Skeleton className="h-8 md:h-12 w-32 md:w-48 bg-red-500/10" /> : `$${totalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                            <div className="flex items-center gap-2 h-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-3 w-16 bg-red-500/10" />
                                ) : (
                                    <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Liability</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projected Earnings */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="absolute top-0 right-0 p-2 md:p-4 opacity-5 group-hover:opacity-100 transition-opacity">
                        <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                <span className="text-lg md:text-xl font-black text-emerald-500">$</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Est. Earnings</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-emerald-400 leading-none tracking-tight mb-2 md:mb-3 h-[1.2em] flex items-center">
                                {!address ? '$0.00' : isDashboardLoading ? <Skeleton className="h-8 md:h-12 w-32 md:w-48 bg-emerald-400/10" /> : `$${(totalNetWorth * (globalNetAPY / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                            <div className="flex items-center gap-2 h-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-3 w-32 bg-emerald-500/10" />
                                ) : (
                                    <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Projected Annual Yield</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PortfolioAnalytics
                address={address}
                isLoading={isDashboardLoading}
                totalNetWorthUsd={totalNetWorth}
                totalSupplyUsd={totalSupplied}
                totalBorrowUsd={totalBorrowed}
                overallHealthFactor={overallHealthFactor}
                positions={allPositions}
                yields={yields}
                onTriggerQuickAction={(payload) => setQuickActionModal(payload)}
            />

            <div className="grid gap-4 md:grid-cols-3">
                {[
                    {
                        name: getProtocolLabel('aave-v3'),
                        img: getProtocolIcon('aave-v3') || '/aave.png',
                        supply: aave.totalSupplyUSD,
                        borrow: aave.totalBorrowUSD,
                        health: healthData.aave,
                        apy: aaveNetAPY,
                    },
                    {
                        name: getProtocolLabel('radiant-v2'),
                        img: getProtocolIcon('radiant-v2') || '/radiant.jpeg',
                        supply: radiant.totalSupplyUSD,
                        borrow: radiant.totalBorrowUSD,
                        health: healthData.radiant,
                        apy: radiantNetAPY,
                    },
                ].map((proto) => (
                    <Card key={proto.name} className="bg-card/50 border-input overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-white shrink-0">
                                    <Image src={proto.img} className="w-full h-full object-cover" alt={proto.name} width={24} height={24} />
                                </div>
                                <span className="truncate">{proto.name}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Supplied</span>
                                <span className="font-mono">
                                    {isDashboardLoading && address ? <Skeleton className="h-4 w-12" /> : `$${proto.supply.toFixed(2)}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Borrowed</span>
                                <span className="font-mono text-red-400">
                                    {isDashboardLoading && address ? <Skeleton className="h-4 w-12" /> : `$${proto.borrow.toFixed(2)}`}
                                </span>
                            </div>
                            <div className="mt-3 pt-2 border-t border-border flex justify-between items-center h-8">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Health</span>
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                ) : (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${proto.health.status === 'safe' ? 'bg-emerald-500/20 text-emerald-500' :
                                        proto.health.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                            proto.health.status === 'danger' ? 'bg-red-500/20 text-red-500' :
                                                'bg-muted/50 text-muted-foreground'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${proto.health.status === 'safe' ? 'bg-emerald-400' :
                                            proto.health.status === 'warning' ? 'bg-amber-400' :
                                                proto.health.status === 'danger' ? 'bg-red-400' : 'bg-muted-foreground'
                                            }`} />
                                        {proto.health.hasPositions ? `${proto.health.healthFactor.toFixed(2)}` : 'N/A'}
                                    </span>
                                )}
                            </div>
                            <div className="pt-2 flex justify-between items-center border-t border-border mt-2 h-8">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Net APY</span>
                                {isDashboardLoading && address ? (
                                    <Skeleton className="h-6 w-14 rounded-full" />
                                ) : (
                                    proto.supply > 0 && (
                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            {proto.apy.toFixed(2)}%
                                        </span>
                                    )
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Area: Markets Only */}
            <Card className="col-span-full border-none shadow-none bg-transparent">
                <Markets />
            </Card>

            {quickActionModal && (
                <MarketModal
                    isOpen={!!quickActionModal}
                    onClose={() => setQuickActionModal(null)}
                    initialMode={quickActionModal.mode}
                    initialTab={quickActionModal.tab}
                    pool={quickActionModal.pool}
                />
            )}
        </div>
    )
}
