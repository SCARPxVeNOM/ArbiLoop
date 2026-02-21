'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetIcon } from "@/components/ui/asset-icon";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Shield, ShieldCheck } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useSmartLoops, SmartLoop } from '@/hooks/useSmartLoops';

type FilterType = 'all' | 'stable';

import { StrategyModal } from './StrategyModal';
import { StrategyInfoModal } from './StrategyInfoModal';
import { Info } from 'lucide-react';

interface TopLoopsProps {
    compact?: boolean;
    maxItems?: number;
    showFilters?: boolean;
}

export function TopLoops({ compact = false, maxItems = 5, showFilters = true }: TopLoopsProps) {
    const router = useRouter();
    const { loops, isLoading, getTopLoops, getStableLoops, getByProtocol } = useSmartLoops();
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectedLoop, setSelectedLoop] = useState<SmartLoop | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    // Apply filters
    let filteredLoops: SmartLoop[] = [];
    switch (filter) {
        case 'stable':
            filteredLoops = getStableLoops();
            break;

        default:
            filteredLoops = getTopLoops(maxItems);
    }

    // Sort: USDT/ETH first, others after
    const usdtEthLoop = filteredLoops.find(l => l.supplyAsset === 'USDT' && l.borrowAsset === 'ETH');
    const otherLoops = filteredLoops.filter(l => !(l.supplyAsset === 'USDT' && l.borrowAsset === 'ETH'));

    const displayLoops = usdtEthLoop
        ? [usdtEthLoop, ...otherLoops].slice(0, maxItems)
        : filteredLoops.slice(0, maxItems);

    const handleMultiply = (loop: SmartLoop) => {
        setSelectedLoop(loop);
        setIsModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Calculating optimal strategies...</span>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header */}
            <div className={`flex items-center justify-between ${compact ? 'mb-4' : 'mb-6 md:mb-8'}`}>
                <div className="flex items-center gap-3">
                    <h2 className={`font-bold text-white font-outfit ${compact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                        {compact ? 'Suggested Strategies' : 'Top Strategies'}
                    </h2>
                    {!compact && (
                        <button
                            onClick={() => setIsInfoOpen(true)}
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-[#CEFF00]"
                            title="How strategies work"
                        >
                            <Info size={18} />
                        </button>
                    )}
                </div>

                {showFilters && (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-wrap">
                            {[
                                { key: 'all', label: 'All', icon: null },
                                { key: 'stable', label: 'Stable', icon: Shield },

                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key as FilterType)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${filter === f.key
                                        ? 'bg-[#CEFF00] text-black shadow-lg'
                                        : 'text-muted-foreground hover:text-white'
                                        }`}
                                >
                                    {f.icon && <f.icon size={14} className={filter === f.key ? "text-black" : "text-current"} />}
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as FilterType)}
                                className="w-[140px] h-8 rounded-full bg-white/5 border border-white/10 text-white text-xs font-bold px-4 outline-none"
                            >
                                <option value="all" className="bg-[#121216] text-white">All Strategies</option>
                                <option value="stable" className="bg-[#121216] text-white">Stable</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* Grid */}
            <div className={`grid gap-4 ${compact
                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
                : 'md:grid-cols-2 lg:grid-cols-4 gap-6'
                }`}>
                {displayLoops.map((loop) => {
                    const isActive = loop.supplyAsset === 'USDT' && loop.borrowAsset === 'ETH';

                    return (
                        <div
                            key={loop.id}
                            onClick={() => isActive && handleMultiply(loop)}
                            className={`group relative bg-[#0f0f12] border rounded-2xl transition-all duration-300 overflow-hidden ${isActive
                                ? 'border-[#CEFF00]/50 shadow-2xl shadow-[#CEFF00]/10 cursor-pointer hover:-translate-y-1'
                                : 'border-white/5 opacity-50 cursor-not-allowed grayscale-[0.5]'
                                } ${compact ? 'p-3' : 'p-4 md:p-6'}`}
                        >
                            {!compact && (
                                <div className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isActive
                                    ? 'text-[#CEFF00] bg-[#CEFF00]/10 border-[#CEFF00]/20'
                                    : 'text-muted-foreground bg-white/5 border-white/5'
                                    }`}>
                                    {isActive ? 'Active' : 'Inactive'} <span className="text-white/20 mx-1">|</span> {loop.protocolDisplay}
                                </div>
                            )}

                            {compact ? (
                                // Compact Layout - Single Row / Denser
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {/* Overlapping Icons */}
                                        <div className="flex items-center">
                                            <div className="relative z-10">
                                                <AssetIcon
                                                    symbol={loop.supplyAsset}
                                                    size={24}
                                                    className="border-2 border-[#121216] rounded-full bg-[#121216]"
                                                />
                                            </div>
                                            <div className="relative -ml-3 z-0">
                                                <AssetIcon
                                                    symbol={loop.borrowAsset}
                                                    size={24}
                                                    className="border-2 border-[#121216] rounded-full grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-sm leading-none group-hover:text-[#CEFF00] transition-colors">
                                                    {loop.pair}
                                                </h3>
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded bg-white/5 text-muted-foreground border-none">
                                                    {loop.protocolDisplay}
                                                </Badge>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                Max {loop.maxLeverage}x
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="font-bold font-mono text-[#CEFF00] text-lg leading-none">
                                            +{loop.leveragedApy}%
                                        </div>
                                        <div className={`text-[9px] mt-0.5 ${loop.risk === 'Low' ? 'text-emerald-400' : loop.risk === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {loop.risk} Risk
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Standard Layout
                                <>
                                    {/* Pair Icons */}
                                    <div className="flex items-center mb-3">
                                        <div className="relative z-10">
                                            <AssetIcon
                                                symbol={loop.supplyAsset}
                                                size={40}
                                                className="border-2 border-[#121216] rounded-full bg-[#121216]"
                                            />
                                        </div>
                                        <div className="relative -ml-2 z-0">
                                            <AssetIcon
                                                symbol={loop.borrowAsset}
                                                size={40}
                                                className="border-2 border-[#121216] rounded-full grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Pair Name */}
                                    <h3 className="font-bold text-white group-hover:text-[#CEFF00] transition-colors text-lg mb-1">
                                        {loop.pair} Strategy
                                    </h3>

                                    {/* Badges */}
                                    <div className="flex gap-1 flex-wrap mb-3">
                                        <Badge
                                            variant="secondary"
                                            className={`text-[9px] border-none ${loop.risk === 'Low'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : loop.risk === 'Medium'
                                                    ? 'bg-amber-500/10 text-amber-400'
                                                    : 'bg-red-500/10 text-red-400'
                                                }`}
                                        >
                                            {loop.risk} Risk
                                        </Badge>
                                        {loop.isStable && (
                                            <Badge variant="secondary" className="text-[9px] bg-blue-500/10 text-blue-400 border-none">
                                                Stable
                                            </Badge>
                                        )}
                                    </div>

                                    {/* APY */}
                                    <div className="border-t border-white/5 pt-4 mt-4">
                                        <div className="text-[10px] text-muted-foreground mb-0.5">
                                            Max {loop.maxLeverage}x Leverage
                                        </div>
                                        <div className="font-bold font-mono text-[#CEFF00] text-3xl">
                                            +{loop.leveragedApy}%
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-1">
                                            Supply: {loop.supplyApy.toFixed(1)}% | Borrow: {loop.borrowApy.toFixed(1)}%
                                        </div>
                                    </div>

                                    {/* Button */}

                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {displayLoops.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No strategies found for this filter. Try a different selection.
                </div>
            )}

            {selectedLoop && (
                <StrategyModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialData={{
                        protocol: selectedLoop.protocol as 'aave' | 'kinza' | 'radiant',
                        supplyAsset: selectedLoop.supplyAsset,
                        borrowAsset: selectedLoop.borrowAsset
                    }}
                />
            )}

            <StrategyInfoModal
                isOpen={isInfoOpen}
                onClose={() => setIsInfoOpen(false)}
            />
        </div>
    );
}
