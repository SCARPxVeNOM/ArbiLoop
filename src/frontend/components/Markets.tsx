'use client';

import { useState, useMemo } from 'react';
import { useYields } from "@/hooks/useYields";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/components/ui/asset-icon";
import Link from 'next/link';
import { getProtocolIcon, getProtocolLabel } from '@/lib/protocols';
import { targetChainName } from '@/lib/network';

export function Markets() {
    const { data: yields, isLoading } = useYields();
    const [sortBy, setSortBy] = useState<'tvl' | 'apy'>('tvl');
    const protocolConfig = useMemo(() => ({
        aaveV3: {
            label: getProtocolLabel('aave-v3'),
            icon: getProtocolIcon('aave-v3') || '/aave.png',
        },
        radiant: {
            label: getProtocolLabel('radiant-v2'),
            icon: getProtocolIcon('radiant-v2') || '/radiant.jpeg',
        },
    }), []);

    // Process data into a map: Symbol -> { protocols: ..., totalTVL: ..., maxAPY: ... }
    const marketData = useMemo(() => {
        if (!yields) return [];

        const map: Record<string, {
            symbol: string;
            aaveV3?: { s: number, b: number, tvl: number };
            radiant?: { s: number, b: number, tvl: number };
            totalSupplied: number;
            totalBorrowed: number;
            maxAPY: number;
            tokenAddress?: string;
        }> = {};

        yields.forEach(pool => {
            const symbol = pool.symbol;
            if (!map[symbol]) {
                const tokenAddress = (pool.underlyingTokens && pool.underlyingTokens.length > 0) ? pool.underlyingTokens[0] : undefined;
                map[symbol] = { symbol, tokenAddress, totalSupplied: 0, totalBorrowed: 0, maxAPY: 0 };
            }

            const data = { s: pool.apy, b: pool.apyBaseBorrow || 0, tvl: pool.tvlUsd };
            const entry = map[symbol];

            // Update Protocol Data
            if (pool.project === 'aave-v3') entry.aaveV3 = data;
            if (pool.project === 'radiant-v2') entry.radiant = data;

            // Update Aggregates
            // Use totalSupplyUsd if available, else tvlUsd. For borrowed, use totalBorrowUsd.
            const supply = pool.totalSupplyUsd || pool.tvlUsd;
            const borrow = pool.totalBorrowUsd || 0;

            entry.totalSupplied += supply;
            entry.totalBorrowed += borrow;

            if (pool.apy > entry.maxAPY) entry.maxAPY = pool.apy;
        });

        // Convert to array and sort
        const arr = Object.values(map);
        return arr.sort((a, b) => {
            if (sortBy === 'tvl') return b.totalSupplied - a.totalSupplied;
            if (sortBy === 'apy') return b.maxAPY - a.maxAPY;
            return 0;
        });

    }, [yields, sortBy]);

    if (isLoading) {
        return (
            <Card className="col-span-full border border-border bg-card">
                <CardHeader>
                    <CardTitle>Global Markets</CardTitle>
                    <CardDescription>Scanning top lending protocols on {targetChainName}...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-40 flex items-center justify-center animate-pulse text-primary/50">
                        Loading live yields...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const formatMoney = (num: number) => {
        if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    return (
        <Card className="col-span-full border border-border bg-card">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-xl md:text-2xl font-bold">Market Opportunities</CardTitle>
                    <CardDescription className="text-sm md:text-base mt-1">Real-time lending & borrowing rates across the {targetChainName} ecosystem.</CardDescription>
                </div>
                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => setSortBy('tvl')}
                        className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'tvl' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Highest TVL
                    </button>
                    <button
                        onClick={() => setSortBy('apy')}
                        className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'apy' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Highest APY
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left hidden md:table">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                                <th className="h-12 px-4 align-middle font-medium min-w-[220px]">Token Name</th>
                                <th className="h-12 px-4 align-middle font-medium text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded-full overflow-hidden bg-white">
                                                <img src={protocolConfig.aaveV3.icon} className="w-full h-full object-cover" alt={protocolConfig.aaveV3.label} />
                                            </div>
                                            {protocolConfig.aaveV3.label}
                                        </div>
                                        <span className="text-[9px] opacity-70">Earn / Pay</span>
                                    </div>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded-full overflow-hidden bg-white">
                                                <img src={protocolConfig.radiant.icon} className="w-full h-full object-cover" alt={protocolConfig.radiant.label} />
                                            </div>
                                            {protocolConfig.radiant.label}
                                        </div>
                                        <span className="text-[9px] opacity-70">Earn / Pay</span>
                                    </div>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-right min-w-[160px]">Quick Trade</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {marketData.map(asset => {
                                const availableProviders = [asset.aaveV3, asset.radiant].filter(Boolean).length;
                                const renderCell = (data?: { s: number, b: number }, isBest?: boolean) => {
                                    if (!data) return <span className="text-muted-foreground/20">-</span>;
                                    const showBest = isBest && data.s >= 0.01 && availableProviders > 1; // Only show if APY >= 0.01% AND multiple providers exist
                                    return (
                                        <div className="flex flex-col items-center relative">
                                            {showBest && (
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                                                    BEST
                                                </div>
                                            )}
                                            <span className={`font-bold font-mono text-xs ${showBest ? 'text-yellow-400 scale-110 transition-transform' : 'text-emerald-400'}`}>
                                                +{data.s.toFixed(2)}%
                                            </span>
                                            <span className="text-red-400/80 font-mono text-[10px]">
                                                {data.b > 0 ? `-${data.b.toFixed(2)}%` : '0.00%'}
                                            </span>
                                        </div>
                                    );
                                };

                                return (
                                    <tr key={asset.symbol} className={`border-b border-border transition-colors hover:bg-muted/50 group ${asset.maxAPY === marketData[0].maxAPY && sortBy === 'apy' ? 'bg-yellow-500/5' : ''}`}>
                                        <td className="p-4 align-middle font-bold flex items-center gap-3">
                                            <AssetIcon symbol={asset.symbol} tokenAddress={asset.tokenAddress} size={40} />
                                            <div className="flex flex-col">
                                                <span className="text-foreground text-base">{asset.symbol}</span>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
                                                    <span>{targetChainName}</span>
                                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                                    <span className="text-emerald-500/80">Deposited: {formatMoney(asset.totalSupplied)}</span>
                                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                                    <span className="text-red-500/60">Loaned: {formatMoney(asset.totalBorrowed)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-center border-l border-border bg-muted/20 group-hover:bg-transparent transition-colors">
                                            {renderCell(asset.aaveV3, asset.maxAPY === asset.aaveV3?.s)}
                                        </td>
                                        <td className="p-4 align-middle text-center border-l border-border bg-muted/20 group-hover:bg-transparent transition-colors">
                                            {renderCell(asset.radiant, asset.maxAPY === asset.radiant?.s)}
                                        </td>
                                        <td className="p-4 align-middle text-right border-l border-border">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/lend/earn?pool=${asset.symbol}`}>
                                                    <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all text-xs font-bold">
                                                        Deposit
                                                    </Button>
                                                </Link>
                                                <Link href={`/lend/borrow?pool=${asset.symbol}`}>
                                                    <Button size="sm" className="h-8 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white hover:border-destructive transition-all text-xs font-bold">
                                                        Borrow
                                                    </Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {marketData.map(asset => {
                            const availableProviders = [asset.aaveV3, asset.radiant].filter(Boolean).length;
                            const renderMobileCell = (label: string, data?: { s: number, b: number }, isBest?: boolean) => {
                                if (!data) return null;
                                return (
                                    <div className="flex flex-col items-center bg-muted/20 p-2 rounded-lg flex-1">
                                        <div className="flex items-center gap-1 mb-1">
                                            {label === protocolConfig.aaveV3.label && <img src={protocolConfig.aaveV3.icon} className="w-3 h-3 rounded-full" alt={protocolConfig.aaveV3.label} />}
                                            {label === protocolConfig.radiant.label && <img src={protocolConfig.radiant.icon} className="w-3 h-3 rounded-full" alt={protocolConfig.radiant.label} />}
                                            <span className="text-[10px] text-muted-foreground">{label}</span>
                                        </div>
                                        <span className={`font-mono text-xs font-bold ${isBest && data.s >= 0.01 && availableProviders > 1 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                            +{data.s.toFixed(2)}%
                                        </span>
                                    </div>
                                );
                            };

                            return (
                                <div key={asset.symbol} className="bg-card border border-border rounded-xl p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <AssetIcon symbol={asset.symbol} tokenAddress={asset.tokenAddress} size={36} />
                                            <div>
                                                <div className="font-bold text-lg">{asset.symbol}</div>
                                                <div className="text-xs text-muted-foreground">{targetChainName}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Total Supplied</div>
                                            <div className="font-mono font-bold text-emerald-500">{formatMoney(asset.totalSupplied)}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {renderMobileCell(protocolConfig.aaveV3.label, asset.aaveV3, asset.maxAPY === asset.aaveV3?.s)}
                                        {renderMobileCell(protocolConfig.radiant.label, asset.radiant, asset.maxAPY === asset.radiant?.s)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Link href={`/lend/earn?pool=${asset.symbol}`} className="w-full">
                                            <Button size="sm" className="w-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white font-bold">
                                                Deposit
                                            </Button>
                                        </Link>
                                        <Link href={`/lend/borrow?pool=${asset.symbol}`} className="w-full">
                                            <Button size="sm" className="w-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white font-bold">
                                                Borrow
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {marketData.length === 0 && <div className="p-8 text-center text-muted-foreground">No matching assets found.</div>}
                </div>
            </CardContent>
        </Card>
    );
}
