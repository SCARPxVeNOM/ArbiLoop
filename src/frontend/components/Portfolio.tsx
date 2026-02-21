'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { AssetIcon } from "@/components/ui/asset-icon";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAggregatedHealth, ProtocolHealth } from "@/hooks/useAggregatedHealth";
import { useAavePortfolio } from "@/hooks/useAavePortfolio";
import { useKinzaPortfolio } from "@/hooks/useKinzaPortfolio";
import { useRadiantPortfolio } from "@/hooks/useRadiantPortfolio";
import { TrendingUp, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Heart, Activity, Loader2 } from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AAVE_COMPTROLLER, COMPTROLLER_ABI } from '@/lib/pool-config';
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// --- Health Factor Badge ---
function HealthBadge({ health }: { health: ProtocolHealth }) {
    if (!health.hasPositions) {
        return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground">
                Inactive
            </span>
        );
    }

    const config = {
        safe: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Safe' },
        warning: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Warning' },
        danger: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'Risk' },
        inactive: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-muted', label: 'Inactive' },
    }[health.status];

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.bg} ${config.text} ${config.border} inline-flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.status === 'safe' ? 'bg-emerald-400' : health.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
            {config.label}
            {health.healthFactor > 0 && (
                <span className="ml-0.5 opacity-70">{health.healthFactor.toFixed(2)}</span>
            )}
        </span>
    );
}

// --- Custom Pie Chart Tooltip ---
function CustomTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-2xl">
                <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                    <span className="font-bold text-sm text-foreground">{data.name}</span>
                </div>
                <div className="text-xs space-y-0.5 text-muted-foreground">
                    <div>Supply: <span className="text-emerald-400 font-mono">${data.supply?.toFixed(2) || '0.00'}</span></div>
                    <div>Borrow: <span className="text-red-400 font-mono">${data.borrow?.toFixed(2) || '0.00'}</span></div>
                    <div>Net: <span className="text-foreground font-mono">${(data.value - (data.borrow || 0)).toFixed(2)}</span></div>
                    <div className="pt-1 border-t border-border mt-1">
                        Share: <span className="font-bold text-foreground">{data.percent?.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

// --- Center Label for Pie ---
function CenterHealthLabel({ score }: { score: number }) {
    const color = score >= 7 ? '#34d399' : score >= 4 ? '#fbbf24' : '#f87171';
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black tracking-tight" style={{ color }}>
                {score.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
                Health Score
            </span>
        </div>
    );
}

export function Portfolio() {
    const { address } = useAccount();
    const router = useRouter();
    const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);

    // Smart Wallet (Using EOA for now as Contracts are removed)
    const walletAddress = address;

    // Portfolio Data
    const { totalSupplyUSD: aaveSupply, totalBorrowUSD: aaveBorrow, positions: aavePositions } = useAavePortfolio();
    const { totalSupplyUSD: kinzaSupply, totalBorrowUSD: kinzaBorrow, positions: kinzaPositions } = useKinzaPortfolio();
    const { totalSupplyUSD: radiantSupply, totalBorrowUSD: radiantBorrow, positions: radiantPositions } = useRadiantPortfolio();

    // Health Data
    const healthData = useAggregatedHealth(walletAddress as `0x${string}` | undefined);
    const { aave: aaveHealth, kinza: kinzaHealth, radiant: radiantHealth, overallScore } = healthData;

    // Aggregations
    const totalSupplied = aaveSupply + kinzaSupply + radiantSupply;
    const totalDebt = aaveBorrow + kinzaBorrow + radiantBorrow;
    const totalNetWorth = totalSupplied - totalDebt;

    // Helper to calculate Net APY
    const calculateNetAPY = (positions: any[], netWorth: number) => {
        if (netWorth <= 0) return 0;
        let totalAnnualIncome = 0;
        let totalAnnualCost = 0;

        positions.forEach(pos => {
            if (pos.supplyUSD > 0) {
                totalAnnualIncome += pos.supplyUSD * (pos.apy / 100);
            }
            if (pos.borrowUSD > 0) {
                totalAnnualCost += pos.borrowUSD * (pos.borrowApy / 100);
            }
        });

        const netAnnual = totalAnnualIncome - totalAnnualCost;
        return (netAnnual / netWorth) * 100;
    };

    const allPositions = [...(aavePositions || []), ...(kinzaPositions || []), ...(radiantPositions || [])];
    const globalNetAPY = calculateNetAPY(allPositions, totalNetWorth);
    const aaveNetAPY = calculateNetAPY(aavePositions || [], aaveSupply - aaveBorrow);
    const kinzaNetAPY = calculateNetAPY(kinzaPositions || [], kinzaSupply - kinzaBorrow);
    const radiantNetAPY = calculateNetAPY(radiantPositions || [], radiantSupply - radiantBorrow);

    // Allocation data with extra info for tooltip
    const allocationData = [
        { name: 'Aave', value: aaveSupply, supply: aaveSupply, borrow: aaveBorrow, color: '#F0B90B', percent: 0 },
        { name: 'Kinza', value: kinzaSupply, supply: kinzaSupply, borrow: kinzaBorrow, color: '#3B82F6', percent: 0 },
        { name: 'Radiant', value: radiantSupply, supply: radiantSupply, borrow: radiantBorrow, color: '#A855F7', percent: 0 },
    ].filter(d => d.value > 0);

    // Calculate percentages
    const allocTotal = allocationData.reduce((s, d) => s + d.value, 0);
    allocationData.forEach(d => { d.percent = allocTotal > 0 ? (d.value / allocTotal) * 100 : 0; });

    const toggleExpand = (protocol: string) => {
        setExpandedProtocol(prev => prev === protocol ? null : protocol);
    };

    // Health status summary
    const getOverallStatus = () => {
        if (totalNetWorth < 0.01) return { text: 'Inactive', color: 'text-muted-foreground', icon: Activity };
        const activeProtocols = [aaveHealth, kinzaHealth, radiantHealth].filter(h => h.hasPositions);
        const anyDanger = activeProtocols.some(h => h.status === 'danger');
        const anyWarning = activeProtocols.some(h => h.status === 'warning');
        if (anyDanger) return { text: 'At Risk', color: 'text-red-500 animate-pulse', icon: AlertTriangle };
        if (anyWarning) return { text: 'Caution', color: 'text-amber-400', icon: AlertTriangle };
        return { text: 'Healthy', color: 'text-emerald-400', icon: ShieldCheck };
    };
    const overallStatus = getOverallStatus();

    const { toast } = useToast();
    const { writeContractAsync } = useWriteContract();
    const [togglingAssets, setTogglingAssets] = useState<Record<string, boolean>>({});

    const handleCollateralToggle = async (vTokenAddress: string, symbol: string, currentStatus: boolean) => {
        if (!address) return;

        setTogglingAssets(prev => ({ ...prev, [vTokenAddress]: true }));
        try {
            if (currentStatus) {
                // Exit Market
                const hash = await writeContractAsync({
                    address: AAVE_COMPTROLLER as `0x${string}`,
                    abi: COMPTROLLER_ABI,
                    functionName: 'exitMarket',
                    args: [vTokenAddress as `0x${string}`],
                });
                toast({
                    title: "Transaction Sent",
                    description: `Disabling ${symbol} as collateral...`,
                });
            } else {
                // Enter Market
                const hash = await writeContractAsync({
                    address: AAVE_COMPTROLLER as `0x${string}`,
                    abi: COMPTROLLER_ABI,
                    functionName: 'enterMarkets',
                    args: [[vTokenAddress as `0x${string}`]],
                });
                toast({
                    title: "Transaction Sent",
                    description: `Enabling ${symbol} as collateral...`,
                });
            }
        } catch (error: any) {
            console.error("Collateral toggle error:", error);
            toast({
                title: "Error",
                description: error.shortMessage || "Failed to toggle collateral",
                variant: "destructive",
            });
        } finally {
            setTogglingAssets(prev => ({ ...prev, [vTokenAddress]: false }));
        }
    };

    const renderPositionsTable = (positions: any[], protocolId: string) => {
        const handleRedirect = (asset: string, protocol: string, type: 'earn' | 'borrow') => {
            const mappedProtocol = protocol === 'kinza' ? 'kinza-finance' : protocol === 'radiant' ? 'radiant-v2' : protocol;
            router.push(`/lend/${type}?asset=${asset}&protocol=${mappedProtocol}`);
        };

        if (!positions || positions.length === 0) {
            return <div className="p-4 text-center text-muted-foreground text-xs">No active positions found.</div>;
        }

        return (
            <div className="bg-[#09090b]/60 p-0 rounded-b-xl border-t border-white/10 animate-in slide-in-from-top-2 overflow-hidden shadow-inner">
                {/* Desktop View */}
                <table className="w-full text-xs hidden md:table">
                    <thead>
                        <tr className="text-muted-foreground uppercase tracking-wider text-[10px] text-left bg-white/5 font-black border-b border-white/5">
                            <th className="py-3 px-4 md:px-8">Asset</th>
                            <th className="py-3 px-4 text-right">APY</th>
                            <th className="py-3 px-4 text-center hidden md:table-cell">Supplied</th>
                            {protocolId === 'aave' && <th className="py-3 px-1 md:px-4 text-center">Collateral</th>}
                            <th className="py-3 px-4 text-right hidden md:table-cell">Borrowed</th>
                            <th className="py-3 px-4 text-right hidden md:table-cell">Value (USD)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {positions.map((pos, idx) => {
                            const netUSD = pos.supplyUSD - pos.borrowUSD;
                            return (
                                <tr
                                    key={idx}
                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => handleRedirect(pos.symbol, protocolId, pos.supply > 0 ? 'earn' : 'borrow')}
                                >
                                    <td className="py-3 px-4 md:px-8 font-bold">
                                        <div className="flex items-center gap-3">
                                            <AssetIcon symbol={pos.symbol} size={24} />
                                            <span className="text-sm tracking-tight">{pos.symbol}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono leading-tight">
                                        {pos.apy > 0 && (
                                            <div className="text-emerald-400 font-bold">+{pos.apy.toFixed(2)}%</div>
                                        )}
                                        {pos.borrowApy > 0 && (
                                            <div className="text-red-400 font-bold">-{pos.borrowApy.toFixed(2)}%</div>
                                        )}
                                        {!(pos.apy > 0) && !(pos.borrowApy > 0) && (
                                            <span className="text-muted-foreground/30">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-center hidden md:table-cell">
                                        <div className="text-emerald-500 font-bold">{pos.supply > 0 ? pos.supply.toFixed(4) : '-'}</div>
                                        {pos.supplyUSD > 0 && <div className="text-[10px] text-muted-foreground/60 font-mono">${pos.supplyUSD.toFixed(2)}</div>}
                                    </td>
                                    {protocolId === 'aave' && (
                                        <td className="py-3 px-1 md:px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-center items-center">
                                                {pos.supply > 0 ? (
                                                    togglingAssets[pos.vTokenAddress] ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                    ) : (
                                                        <Switch
                                                            checked={pos.isCollateral}
                                                            onCheckedChange={() => handleCollateralToggle(pos.vTokenAddress, pos.symbol, pos.isCollateral)}
                                                            disabled={togglingAssets[pos.vTokenAddress]}
                                                        />
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground/30 text-[10px]">—</span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td className="py-3 px-4 text-right hidden md:table-cell">
                                        <div className="text-red-400 font-bold">{pos.borrow > 0 ? pos.borrow.toFixed(4) : '-'}</div>
                                        {pos.borrowUSD > 0 && <div className="text-[10px] text-muted-foreground/60 font-mono">${pos.borrowUSD.toFixed(2)}</div>}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-muted-foreground hidden md:table-cell">
                                        <span className={cn("font-bold", netUSD > 0 ? "text-emerald-500" : netUSD < 0 ? "text-red-500" : "")}>
                                            ${netUSD.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Mobile List View */}
                <div className="md:hidden flex flex-col divide-y divide-white/5">
                    {positions.map((pos, idx) => {
                        const netUSD = pos.supplyUSD - pos.borrowUSD;
                        return (
                            <div
                                key={idx}
                                className="p-4 bg-black/20 hover:bg-black/30 transition-colors cursor-pointer border-b border-white/5 last:border-0"
                                onClick={() => handleRedirect(pos.symbol, protocolId, pos.supply > 0 ? 'earn' : 'borrow')}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <AssetIcon symbol={pos.symbol} size={28} />
                                        <div>
                                            <div className="font-black text-sm text-white tracking-tight">{pos.symbol}</div>
                                            <div className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest italic">{protocolId} Asset</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("text-xs font-black font-mono", netUSD > 0 ? "text-emerald-400" : netUSD < 0 ? "text-red-400" : "text-muted-foreground")}>
                                            ${netUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[9px] uppercase text-muted-foreground/40 font-black tracking-tighter">Net Value</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] uppercase text-emerald-500/50 font-black tracking-widest">Supply</span>
                                            {pos.apy > 0 && <span className="text-[10px] font-black text-emerald-400">+{pos.apy.toFixed(2)}%</span>}
                                        </div>
                                        <div className="text-xs font-black text-white font-mono">
                                            {pos.supply > 0 ? pos.supply.toFixed(4) : '—'}
                                        </div>
                                        {pos.supplyUSD > 0 && <div className="text-[9px] text-muted-foreground/40 font-bold">${pos.supplyUSD.toFixed(2)}</div>}
                                    </div>

                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] uppercase text-red-500/50 font-black tracking-widest">Borrow</span>
                                            {pos.borrowApy > 0 && <span className="text-[10px] font-black text-red-400">-{pos.borrowApy.toFixed(2)}%</span>}
                                        </div>
                                        <div className="text-xs font-black text-white font-mono">
                                            {pos.borrow > 0 ? pos.borrow.toFixed(4) : '—'}
                                        </div>
                                        {pos.borrowUSD > 0 && <div className="text-[9px] text-muted-foreground/40 font-bold">${pos.borrowUSD.toFixed(2)}</div>}
                                    </div>
                                </div>

                                {protocolId === 'aave' && pos.supply > 0 && (
                                    <div className="mt-3 flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase text-muted-foreground/60 font-black tracking-widest">Collateral Mode</span>
                                            <span className="text-[10px] text-blue-400/80 font-bold italic">Required for Borrowing</span>
                                        </div>
                                        {togglingAssets[pos.vTokenAddress] ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <Switch
                                                checked={pos.isCollateral}
                                                onCheckedChange={() => handleCollateralToggle(pos.vTokenAddress, pos.symbol, pos.isCollateral)}
                                                disabled={togglingAssets[pos.vTokenAddress]}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const protocols = [
        { id: 'aave', name: 'Aave', img: '/aave.png', supply: aaveSupply, borrow: aaveBorrow, health: aaveHealth, positions: aavePositions, utilization: aaveHealth.borrowPowerUSD > 0 ? (aaveHealth.debtUSD / aaveHealth.borrowPowerUSD) * 100 : 0, apy: aaveNetAPY },
        { id: 'kinza', name: 'Kinza', img: '/kinza.png', supply: kinzaSupply, borrow: kinzaBorrow, health: kinzaHealth, positions: kinzaPositions, utilization: kinzaHealth.borrowPowerUSD > 0 ? (kinzaHealth.debtUSD / kinzaHealth.borrowPowerUSD) * 100 : 0, apy: kinzaNetAPY },
        { id: 'radiant', name: 'Radiant', img: '/radiant.jpeg', supply: radiantSupply, borrow: radiantBorrow, health: radiantHealth, positions: radiantPositions, utilization: radiantHealth.borrowPowerUSD > 0 ? (radiantHealth.debtUSD / radiantHealth.borrowPowerUSD) * 100 : 0, apy: radiantNetAPY },
    ];

    return (
        <div className="container pt-0 md:pt-8 pb-24 space-y-8 max-w-screen-2xl mx-auto px-0 md:px-16">
            <div className="flex items-center justify-between px-4 md:px-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 font-outfit bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
                        My Portfolio
                    </h1>
                    <div className="text-sm text-muted-foreground">Detailed breakdown of your DeFi positions across Arbitrum.</div>
                </div>
                {walletAddress && (
                    <div className="text-xs font-mono bg-muted px-3 py-1 rounded-full text-muted-foreground">
                        Wallet: {String(walletAddress).substring(0, 6)}...{String(walletAddress).substring(38)}
                    </div>
                )}
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6 px-4 md:px-0">
                {/* Net Worth */}
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
                            <div className="text-2xl md:text-5xl font-bold text-white leading-none tracking-tight mb-2 md:mb-3">
                                ${(totalNetWorth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                {healthData.isLoading && address ? (
                                    <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Loading...</span>
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

                {/* Total Supplied */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shrink-0">
                                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Total Supplied</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-emerald-400 leading-none tracking-tight mb-2 md:mb-3">
                                ${!address ? '0.00' : healthData.isLoading ? '...' : totalSupplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Collateral & Liquidity</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Borrowed */}
                <div className="group relative overflow-hidden rounded-[2rem] bg-[#0A0A0B] border border-white/10 p-5 md:p-8 transition-all hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-5 md:mb-8">
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground/40 leading-none">Total Borrowed</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-5xl font-bold text-red-500 leading-none tracking-tight mb-2 md:mb-3">
                                ${!address ? '0.00' : healthData.isLoading ? '...' : totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Global Borrowed Amount</span>
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
                            <div className="text-2xl md:text-5xl font-bold text-emerald-400 leading-none tracking-tight mb-2 md:mb-3">
                                ${!address ? '0.00' : healthData.isLoading ? '...' : (totalNetWorth * (globalNetAPY / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Projected Annual Yield</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Protocol Allocation Chart */}
                <Card className="lg:col-span-1 mx-4 md:mx-0 border border-border bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg md:text-2xl">Protocol Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-6">
                        {allocationData.length > 0 ? (
                            <>
                                <div className="h-[240px] w-full relative outline-none focus:outline-none">
                                    <CenterHealthLabel score={overallScore} />
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                className="outline-none focus:outline-none"
                                                data={allocationData}
                                                innerRadius={65}
                                                outerRadius={90}
                                                paddingAngle={4}
                                                dataKey="value"
                                                cornerRadius={8}
                                                stroke="none"
                                            >
                                                {allocationData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                content={<CustomTooltip />}
                                                wrapperStyle={{ zIndex: 40 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="flex justify-center gap-4 mt-4">
                                    {allocationData.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-1.5 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="text-muted-foreground">{entry.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                                    <TrendingUp className="opacity-50" />
                                </div>
                                <span className="text-sm font-medium">No active positions</span>
                                <span className="text-xs opacity-50 text-center px-4">Assets supplied to Aave, Kinza, or Radiant will appear here.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Protocol Breakdown Table */}
                <Card className="lg:col-span-2 mx-1 md:mx-0 border border-border bg-card">
                    <CardHeader className="p-3 md:p-6 pb-2 md:pb-4">
                        <CardTitle>Protocol Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 md:p-6">
                        {/* Desktop Table */}
                        <div className="rounded-md border border-border overflow-hidden hidden md:block">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest">Protocol</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Liquidity / Collateral</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Debt</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Net APY</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Utilization</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Health</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {protocols.map((proto) => (
                                        <React.Fragment key={proto.id}>
                                            <tr
                                                className={cn(
                                                    "transition-all cursor-pointer",
                                                    expandedProtocol === proto.id ? "bg-white/[0.03]" : "hover:bg-muted/50"
                                                )}
                                                onClick={() => toggleExpand(proto.id)}
                                            >
                                                <td className="p-4 font-bold flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow-sm border border-white/10">
                                                        <img src={proto.img} className="w-full h-full object-cover" alt={proto.name} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black tracking-tight">{proto.name}</span>
                                                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest leading-none mt-1">
                                                            {expandedProtocol === proto.id ? 'Hide Details' : 'Show Details'}
                                                        </span>
                                                    </div>
                                                    {expandedProtocol === proto.id ? <ChevronUp size={16} className="text-primary ml-auto" /> : <ChevronDown size={16} className="text-muted-foreground ml-auto" />}
                                                </td>
                                                <td className="p-4 text-right font-mono">${proto.supply.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-red-400">${proto.borrow.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-emerald-400 font-bold">{proto.apy.toFixed(2)}%</td>
                                                <td className="p-4 min-w-[140px]">
                                                    <div className="flex flex-col gap-1.5 px-2">
                                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                                            <span className="text-muted-foreground">Credit Used</span>
                                                            <span className={cn(
                                                                "font-bold",
                                                                proto.utilization > 90 ? "text-red-400" : proto.utilization > 70 ? "text-amber-400" : "text-emerald-400"
                                                            )}>
                                                                {proto.utilization.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                            <motion.div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-500",
                                                                    proto.utilization > 90 ? "bg-red-500" : proto.utilization > 70 ? "bg-amber-500" : "bg-emerald-500"
                                                                )}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(100, proto.utilization)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <HealthBadge health={proto.health} />
                                                </td>
                                            </tr>
                                            {expandedProtocol === proto.id && (
                                                <tr>
                                                    <td colSpan={6} className="p-0 border-b-2 border-primary/20 bg-primary/[0.01]">
                                                        {renderPositionsTable(proto.positions, proto.id)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {protocols.map((proto) => (
                                <div
                                    key={proto.id}
                                    className={cn(
                                        "rounded-xl border transition-all overflow-hidden",
                                        expandedProtocol === proto.id ? "border-primary/40 bg-white/[0.04] shadow-lg shadow-black/40" : "border-border bg-card"
                                    )}
                                >
                                    <div className="p-4 flex flex-col gap-4 cursor-pointer" onClick={() => toggleExpand(proto.id)}>
                                        {/* Top Row: Identity & Action */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-white/10 shadow-sm">
                                                    <img src={proto.img} className="w-full h-full object-cover" alt={proto.name} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-lg tracking-tight leading-none mb-1.5">{proto.name}</div>
                                                    <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest leading-none">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-muted-foreground/50 text-[8px]">Net Worth</span>
                                                            <span className="text-white text-xs">${(proto.supply - proto.borrow).toFixed(2)}</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-white/10" />
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-emerald-500/50 text-[8px]">Net APY</span>
                                                            <span className="text-emerald-400 text-xs">{proto.apy.toFixed(2)}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <HealthBadge health={proto.health} />
                                                {expandedProtocol === proto.id ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
                                            </div>
                                        </div>

                                        {/* Middle Section: Supply & Debt Grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-emerald-500/50 font-black tracking-widest">Supply</span>
                                                <span className="text-sm font-black text-white font-mono">${proto.supply.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-red-500/50 font-black tracking-widest">Debt</span>
                                                <span className="text-sm font-black text-red-400 font-mono">${proto.borrow.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Bottom Section: Utilization Progress */}
                                        <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
                                            <div className="flex justify-between items-center text-[10px] mb-2 font-black">
                                                <span className="text-muted-foreground/60 uppercase tracking-widest">Utilization</span>
                                                <span className={cn(
                                                    "font-black tabular-nums tracking-tighter",
                                                    proto.utilization > 90 ? "text-red-400" : proto.utilization > 70 ? "text-amber-400" : "text-emerald-400"
                                                )}>
                                                    {proto.utilization.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        proto.utilization > 90 ? "bg-red-500" : proto.utilization > 70 ? "bg-amber-500" : "bg-emerald-500"
                                                    )}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, proto.utilization)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {expandedProtocol === proto.id && (
                                        <div className="border-t border-white/10 shadow-inner">
                                            {renderPositionsTable(proto.positions, proto.id)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

