'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useYields } from "@/hooks/useYields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/components/ui/asset-icon";

export default function MarketDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const symbol = (params.symbol as string).toUpperCase();
    const { data: yields } = useYields();

    const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
    const [selectedProtocol, setSelectedProtocol] = useState<string>('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'lend' || tab === 'borrow') setActiveTab(tab);
    }, [searchParams]);

    const assetPools = yields?.filter((p) => p.symbol.toUpperCase() === symbol) || [];

    useEffect(() => {
        if (assetPools.length > 0 && !selectedProtocol) {
            const best = assetPools.reduce((prev, current) => (prev.apy > current.apy ? prev : current));
            setSelectedProtocol(best.project);
        }
    }, [assetPools, selectedProtocol]);

    const currentPool = assetPools.find((p) => p.project === selectedProtocol) || assetPools[0];

    return (
        <div className="pt-32 min-h-screen bg-[#0B0B0F] text-foreground">
            <div className="container py-8 max-w-screen-2xl mx-auto px-8 md:px-16 space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-muted-foreground hover:text-white transition-colors">
                        Back to Markets
                    </Link>
                </div>

                <div className="flex items-center gap-6">
                    <AssetIcon symbol={symbol} size={64} />
                    <div>
                        <h1 className="text-4xl font-bold text-white">{symbol}</h1>
                        <p className="text-muted-foreground">Arbitrum</p>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="glass-card border-l-4 border-l-primary/50 relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Live Market Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {currentPool ? (
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">Supply APY</div>
                                            <div className="text-2xl font-bold text-emerald-400">{currentPool.apy.toFixed(2)}%</div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">Borrow APY</div>
                                            <div className="text-2xl font-bold text-red-400">-{(currentPool.apyBaseBorrow || 0).toFixed(2)}%</div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">TVL</div>
                                            <div className="text-2xl font-bold text-white">${(currentPool.tvlUsd / 1_000_000).toFixed(2)}M</div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">Total Supply</div>
                                            <div className="text-lg font-bold text-white">${((currentPool.totalSupplyUsd || 0) / 1_000_000).toFixed(2)}M</div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">Total Borrow</div>
                                            <div className="text-lg font-bold text-white">${((currentPool.totalBorrowUsd || 0) / 1_000_000).toFixed(2)}M</div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground uppercase">Max LTV</div>
                                            <div className="text-lg font-bold text-white">{((currentPool.ltv || 0) * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No live pool data available for this asset.</div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid md:grid-cols-3 gap-4">
                            {assetPools.map((pool) => (
                                <div
                                    key={pool.pool}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedProtocol === pool.project ? 'bg-primary/10 border-primary' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                                    onClick={() => setSelectedProtocol(pool.project)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="capitalize font-bold">{pool.project}</span>
                                        {selectedProtocol === pool.project && <div className="h-2 w-2 rounded-full bg-primary"></div>}
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Supply</span>
                                            <span className="text-emerald-400 font-mono font-bold">{pool.apy.toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Borrow</span>
                                            <span className="text-red-400 font-mono font-bold">-{(pool.apyBaseBorrow || 0).toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-white/5 mt-1">
                                            <span className="text-[10px] text-muted-foreground">TVL</span>
                                            <span className="text-[10px] text-muted-foreground">${(pool.tvlUsd / 1_000_000).toFixed(1)}M</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Card className="glass-card border border-white/10 shadow-2xl bg-[#121216]">
                            <div className="flex border-b border-white/5">
                                <button
                                    onClick={() => setActiveTab('lend')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'lend' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-white'}`}
                                >
                                    Lend / Supply
                                </button>
                                <button
                                    onClick={() => setActiveTab('borrow')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'borrow' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-white'}`}
                                >
                                    Borrow
                                </button>
                            </div>

                            <CardContent className="p-6 space-y-6">
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Protocol</span>
                                        <span className="capitalize font-bold text-white">{selectedProtocol || 'Select Protocol'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{activeTab === 'lend' ? 'Supply APY' : 'Borrow APY'}</span>
                                        <span className="text-white font-bold">
                                            {currentPool ? (activeTab === 'lend' ? `+${currentPool.apy.toFixed(2)}%` : `-${(currentPool.apyBaseBorrow || 0).toFixed(2)}%`) : '--'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">TVL</span>
                                        <span className="text-white">{currentPool ? `$${(currentPool.tvlUsd / 1_000_000).toFixed(2)}M` : '--'}</span>
                                    </div>
                                </div>

                                <Link href={activeTab === 'lend' ? '/lend/earn' : '/lend/borrow'}>
                                    <Button className="w-full h-14 text-lg font-bold bg-[#ceff00] text-black hover:bg-[#b8e600] rounded-xl shadow-[0_0_20px_rgba(206,255,0,0.2)] transition-all transform active:scale-[0.98]">
                                        {activeTab === 'lend' ? `Open Earn for ${symbol}` : `Open Borrow for ${symbol}`}
                                    </Button>
                                </Link>

                                <div className="text-center text-[10px] text-muted-foreground">
                                    Live rates from DeFiLlama yields feed
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
