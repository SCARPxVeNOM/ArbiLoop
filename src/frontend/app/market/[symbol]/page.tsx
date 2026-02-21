'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useYields } from "@/hooks/useYields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/components/ui/asset-icon";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { format } from 'date-fns';

export default function MarketDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const symbol = (params.symbol as string).toUpperCase();
    const { data: yields } = useYields();

    // Tab State: 'lend' or 'borrow' (default from URL or 'lend')
    const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
    const [selectedProtocol, setSelectedProtocol] = useState<string>('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'lend' || tab === 'borrow') setActiveTab(tab);
    }, [searchParams]);

    // Mock Chart Data
    const chartData = [
        { name: 'Jan', value: 400 },
        { name: 'Feb', value: 300 },
        { name: 'Mar', value: 500 },
        { name: 'Apr', value: 280 },
        { name: 'May', value: 590 },
    ];

    // Filter pools
    const assetPools = yields?.filter(p => p.symbol.toUpperCase() === symbol) || [];

    // Set default protocol to highest APY on load
    useEffect(() => {
        if (assetPools.length > 0 && !selectedProtocol) {
            const best = assetPools.reduce((prev, current) => (prev.apy > current.apy) ? prev : current);
            setSelectedProtocol(best.project);
        }
    }, [assetPools, selectedProtocol]);

    const currentPool = assetPools.find(p => p.project === selectedProtocol) || assetPools[0];

    return (
        <div className="pt-32 min-h-screen bg-[#0B0B0F] text-foreground">
            <div className="container py-8 max-w-screen-2xl mx-auto px-8 md:px-16 space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-muted-foreground hover:text-white transition-colors">
                        ← Back to Markets
                    </Link>
                </div>

                <div className="flex items-center gap-6">
                    <AssetIcon symbol={symbol} size={64} />
                    <div>
                        <h1 className="text-4xl font-bold text-white">{symbol}</h1>
                        <p className="text-muted-foreground">Arbitrum</p>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid gap-8 lg:grid-cols-3">

                    {/* Left: Chart & Info */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="glass-card border-l-4 border-l-primary/50 relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Market Overview</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#F0B90B" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#F0B90B" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip contentStyle={{ backgroundColor: '#1a1b23', borderColor: '#333' }} />
                                        <Area type="monotone" dataKey="value" stroke="#F0B90B" fill="url(#colorValue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Protocol Stats Grid */}
                        <div className="grid md:grid-cols-3 gap-4">
                            {assetPools.map(pool => (
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
                                            <span className="text-red-400 font-mono font-bold">-{pool.apyBaseBorrow?.toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-white/5 mt-1">
                                            <span className="text-[10px] text-muted-foreground">TVL</span>
                                            <span className="text-[10px] text-muted-foreground">${(pool.tvlUsd / 1000000).toFixed(1)}M</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Interaction Card */}
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
                                {/* Input Area */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                                        <span>Amount</span>
                                        <span>Balance: 0.00</span>
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-4 pr-24 text-2xl font-mono text-white focus:outline-none focus:border-primary/50 transition-colors"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                        />
                                        <div className="absolute right-3 top-2 bottom-2 bg-white/5 rounded-lg px-3 flex items-center justify-center gap-2 border border-white/5">
                                            <AssetIcon symbol={symbol} size={20} />
                                            <span className="font-bold text-sm">{symbol}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Protocol Selector Dropdown (Simulated with current selection text) */}
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Protocol</span>
                                        <span className="capitalize font-bold text-white flex items-center gap-2">
                                            {selectedProtocol || 'Select Protocol'}
                                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                                {activeTab === 'lend' ? `+${currentPool?.apy.toFixed(2)}%` : `-${currentPool?.apyBaseBorrow?.toFixed(2)}%`}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Liquidity</span>
                                        <span className="text-white">${currentPool ? (currentPool.tvlUsd / 1000000).toFixed(2) : '0.00'}M</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Utilization</span>
                                        <span className="text-white">--%</span>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button className="w-full h-14 text-lg font-bold bg-[#ceff00] text-black hover:bg-[#b8e600] rounded-xl shadow-[0_0_20px_rgba(206,255,0,0.2)] transition-all transform active:scale-[0.98]">
                                    {activeTab === 'lend' ? `Supply ${symbol}` : `Borrow ${symbol}`}
                                </Button>

                                <div className="text-center text-[10px] text-muted-foreground">
                                    Powered by ArbiLoop Smart Wallet
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
