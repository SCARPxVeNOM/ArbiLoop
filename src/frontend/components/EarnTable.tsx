'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useYields } from "@/hooks/useYields";
import { useAavePortfolio } from '@/hooks/useAavePortfolio';
import { useRadiantPortfolio } from '@/hooks/useRadiantPortfolio';
import { AssetIcon } from "@/components/ui/asset-icon";
import { ChevronRight, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { MarketModal } from "./MarketModal";
import { formatMoney, formatTokenAmount } from "@/lib/utils";
import { ACTIVE_PROTOCOLS, getProtocolIcon, getProtocolLabel } from '@/lib/protocols';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';

export function EarnTable() {
    const { address } = useAccount();
    const { data: yields, isLoading: isYieldsLoading } = useYields();
    const { positions: aavePositions, isLoading: isAaveLoading } = useAavePortfolio();
    const { positions: radiantPositions, isLoading: isRadiantLoading } = useRadiantPortfolio();
    const { records: activityRecords } = useActivityTimeline();

    const [selectedPool, setSelectedPool] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ column: 'apy' | 'default', direction: 'asc' | 'desc' | 'none' }>({
        column: 'default',
        direction: 'none'
    });
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const PROTOCOLS = useMemo(
        () =>
            ACTIVE_PROTOCOLS.map((protocol) => ({
                id: protocol.id,
                name: protocol.label,
                img: protocol.icon,
            })),
        [],
    );

    const toggleApySort = () => {
        setSortConfig(prev => {
            if (prev.column !== 'apy') return { column: 'apy', direction: 'desc' };
            if (prev.direction === 'desc') return { column: 'apy', direction: 'asc' };
            if (prev.direction === 'asc') return { column: 'apy', direction: 'none' };
            return { column: 'apy', direction: 'desc' };
        });
    };

    const handleClose = () => {
        setSelectedPool(null);
        // Clear URL search parameters to prevent the deep-linking useEffect from re-opening it
        if (searchParams.get('asset')) {
            router.replace(pathname, { scroll: false });
        }
    };

    const isLoading = isYieldsLoading || (!!address && (isAaveLoading || isRadiantLoading));

    const calculateEstimatedEarnings = (depositedUsd: number, apy: number) => {
        const yearly = depositedUsd > 0 ? depositedUsd * (apy / 100) : 0;
        const monthly = yearly / 12;
        return { yearly, monthly };
    };

    const trackedEarningsByPool = useMemo(() => {
        const ledger = new Map<string, { principalUSD: number; realizedUSD: number; hasTrackedActivity: boolean }>();
        const confirmedEarnActions = activityRecords
            .filter((record) =>
                record.status === 'confirmed' &&
                (record.action === 'deposit' || record.action === 'withdraw') &&
                typeof record.amountUsd === 'number' &&
                Number.isFinite(record.amountUsd)
            )
            .sort((a, b) => a.createdAt - b.createdAt);

        confirmedEarnActions.forEach((record) => {
            const key = `${record.protocol}-${String(record.asset).toUpperCase()}`;
            const entry = ledger.get(key) || { principalUSD: 0, realizedUSD: 0, hasTrackedActivity: false };
            const amountUsd = Math.max(0, Number(record.amountUsd || 0));
            entry.hasTrackedActivity = true;

            if (record.action === 'deposit') {
                entry.principalUSD += amountUsd;
            } else {
                const principalPart = Math.min(entry.principalUSD, amountUsd);
                const realizedPart = Math.max(0, amountUsd - entry.principalUSD);
                entry.principalUSD = Math.max(0, entry.principalUSD - principalPart);
                entry.realizedUSD += realizedPart;
            }

            ledger.set(key, entry);
        });

        return ledger;
    }, [activityRecords]);

    const getEarningsForPool = (pool: any, depositedUSD: number) => {
        const estimated = calculateEstimatedEarnings(depositedUSD, pool.apy);
        const key = `${pool.project}-${pool.symbol}`.toUpperCase();
        const tracked = trackedEarningsByPool.get(key);

        if (!tracked?.hasTrackedActivity) {
            return {
                mode: 'estimated' as const,
                realizedUSD: 0,
                unrealizedUSD: 0,
                totalUSD: estimated.yearly,
                estimatedYearlyUSD: estimated.yearly,
                estimatedMonthlyUSD: estimated.monthly,
            };
        }

        const unrealizedUSD = Math.max(0, depositedUSD - tracked.principalUSD);
        const totalUSD = tracked.realizedUSD + unrealizedUSD;

        return {
            mode: 'tracked' as const,
            realizedUSD: tracked.realizedUSD,
            unrealizedUSD,
            totalUSD,
            estimatedYearlyUSD: estimated.yearly,
            estimatedMonthlyUSD: estimated.monthly,
        };
    };

    // Map positions for O(1) lookup: key = `${protocol}-${symbol}`
    const positionMap = useMemo(() => {
        const map = new Map<string, any>();

        const addPosition = (key: string, pos: any) => {
            if (map.has(key)) {
                const existing = map.get(key);
                existing.supply += pos.supply;
                existing.supplyUSD += pos.supplyUSD;
                existing.borrow += pos.borrow;
                existing.borrowUSD += pos.borrowUSD;
            } else {
                map.set(key, { ...pos });
            }
        };

        aavePositions.forEach((pos: any) => {
            addPosition(`aave-v3-${pos.symbol}`.toUpperCase(), pos);
        });
        radiantPositions.forEach((pos: any) => {
            addPosition(`radiant-v2-${pos.symbol}`.toUpperCase(), pos);
        });

        return map;
    }, [aavePositions, radiantPositions]);

    const earningsData = useMemo(() => {
        if (!yields) return [];

        let data = yields.filter(pool => pool.apy > 0);

        // Filter by protocol
        if (selectedProtocol) {
            data = data.filter(pool => pool.project === selectedProtocol);
        }

        // Sort
        return data.sort((a, b) => {
            if (sortConfig.column === 'apy' && sortConfig.direction !== 'none') {
                return sortConfig.direction === 'desc' ? b.apy - a.apy : a.apy - b.apy;
            }

            // Default Sort: User Supply USD (desc) then TVL (desc)
            const keyA = `${a.project}-${a.symbol}`.toUpperCase();
            const keyB = `${b.project}-${b.symbol}`.toUpperCase();
            const posA = positionMap.get(keyA);
            const posB = positionMap.get(keyB);
            const supplyA = posA?.supplyUSD || 0;
            const supplyB = posB?.supplyUSD || 0;

            if (supplyA !== supplyB) return supplyB - supplyA;
            return (b.tvlUsd || 0) - (a.tvlUsd || 0);
        });
    }, [yields, selectedProtocol, sortConfig, positionMap]);

    const lastUrlKey = useRef<string | null>(null);

    // Handle Deep Linking (Auto-open modal)
    useEffect(() => {
        const assetQuery = searchParams.get('asset');
        const protocolQuery = searchParams.get('protocol');
        const currentUrlKey = assetQuery ? `${assetQuery}-${protocolQuery || 'any'}` : null;

        if (earningsData.length > 0) {
            if (currentUrlKey && currentUrlKey !== lastUrlKey.current) {
                const foundPool = earningsData.find(pool =>
                    pool.symbol.toUpperCase() === assetQuery!.toUpperCase() &&
                    (!protocolQuery || pool.project.toLowerCase() === protocolQuery.toLowerCase())
                );
                if (foundPool) {
                    setSelectedPool(foundPool);
                    lastUrlKey.current = currentUrlKey;
                }
            } else if (!currentUrlKey) {
                lastUrlKey.current = null;
            }
        }
    }, [earningsData, searchParams]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-muted/10 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
                <button className="px-4 py-1.5 rounded-full bg-[#1A1A1E] text-white text-sm font-medium border border-blue-500/20 text-blue-400">
                    Earn
                </button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {PROTOCOLS.map(proto => (
                            <button
                                key={proto.id}
                                onClick={() => setSelectedProtocol(selectedProtocol === proto.id ? null : proto.id)}
                                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden bg-black/40 ${selectedProtocol === proto.id ? 'border-blue-500 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'border-white/5 opacity-50 hover:opacity-100 hover:border-white/20'}`}
                                title={proto.name}
                            >
                                <img src={proto.img} className="w-full h-full object-cover rounded-full" alt={proto.name} />
                            </button>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center gap-2 bg-muted/20 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('card')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-muted text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-muted text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 md:gap-4 px-2 md:px-6 py-2 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-5 md:col-span-4">Vault</div>
                        <div
                            className="col-span-3 md:col-span-2 text-right cursor-pointer hover:text-white transition-colors flex items-center justify-end gap-1"
                            onClick={toggleApySort}
                        >
                            APY
                            {sortConfig.column === 'apy' && sortConfig.direction === 'desc' && <ArrowDown className="w-3 h-3 text-blue-500" />}
                            {sortConfig.column === 'apy' && sortConfig.direction === 'asc' && <ArrowUp className="w-3 h-3 text-blue-500" />}
                            {(sortConfig.column !== 'apy' || sortConfig.direction === 'none') && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                        <div className="hidden md:block col-span-2 text-right">Deposited</div>
                        <div className="hidden md:block col-span-2 text-right">Earnings</div>
                        <div className="col-span-4 md:col-span-2 text-right pr-2 md:pr-0">TVL</div>
                    </div>

                    {/* Table Body */}
                    <div className="space-y-2">
                        {earningsData.map((pool) => {
                            const protocolDisplay = getProtocolLabel(pool.project);
                            const protocolImg = getProtocolIcon(pool.project);

                            // Lookup position (Case-insensitive matching)
                            const userPosition = positionMap.get(`${pool.project}-${pool.symbol}`.toUpperCase());
                            const depositedAmount = userPosition ? userPosition.supply : 0;
                            const depositedUSD = userPosition ? userPosition.supplyUSD : 0;
                            const earnings = getEarningsForPool(pool, depositedUSD);

                            return (
                                <div
                                    key={`${pool.pool}-${pool.project}`}
                                    className="group relative bg-[#0f0f12] hover:bg-[#16161a] border border-white/5 hover:border-white/10 rounded-xl md:rounded-2xl transition-all duration-300 cursor-pointer"
                                    onClick={() => setSelectedPool(pool)}
                                >
                                    <div className="grid grid-cols-12 gap-2 md:gap-4 px-2 md:px-6 py-3 md:py-5 items-center">
                                        {/* Vault */}
                                        <div className="col-span-5 md:col-span-4 flex items-center gap-2 md:gap-4">
                                            <div className="relative flex-shrink-0">
                                                <AssetIcon symbol={pool.symbol} className="w-6 h-6 md:w-10 md:h-10" />
                                                {protocolImg && (
                                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-5 md:h-5 rounded-full border border-[#0f0f12] bg-white overflow-hidden">
                                                        <img src={protocolImg} className="w-full h-full object-cover" alt={protocolDisplay} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-white text-xs md:text-base truncate leading-tight">{pool.symbol}</span>
                                                <span className="text-[9px] md:text-xs text-muted-foreground truncate leading-tight">{protocolDisplay}</span>
                                            </div>
                                        </div>

                                        {/* APY */}
                                        <div className="col-span-3 md:col-span-2 text-right">
                                            <div className="flex flex-col md:flex-row items-end md:items-center justify-end gap-0.5 md:gap-1.5 font-mono text-blue-400 font-bold text-xs md:text-base">
                                                <span>{pool.apy.toFixed(2)}%</span>
                                            </div>
                                        </div>

                                        {/* Deposited */}
                                        <div className="hidden md:block col-span-2 text-right font-mono text-sm">
                                            {depositedAmount > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-white font-medium">{formatTokenAmount(depositedAmount)} {pool.symbol}</span>
                                                    <span className="text-xs text-muted-foreground">{formatMoney(depositedUSD)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </div>

                                        {/* Earnings */}
                                        <div className="hidden md:block col-span-2 text-right font-mono text-muted-foreground text-sm">
                                            {depositedUSD > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    {earnings.mode === 'tracked' ? (
                                                        <>
                                                            <span className="text-blue-400 font-semibold">Real: {formatMoney(earnings.realizedUSD)}</span>
                                                            <span className="text-xs text-muted-foreground">Live: {formatMoney(earnings.unrealizedUSD)}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-blue-400 font-semibold">{formatMoney(earnings.estimatedYearlyUSD)}/yr</span>
                                                            <span className="text-xs text-muted-foreground">Est: {formatMoney(earnings.estimatedMonthlyUSD)}/mo</span>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </div>

                                        {/* TVL */}
                                        <div className="col-span-4 md:col-span-2 flex items-center justify-end pl-0 md:pl-4 gap-1">
                                            <div className="flex flex-col items-end flex-1 min-w-0">
                                                <span className="font-bold text-white text-[10px] md:text-sm max-w-full truncate">{formatMoney(pool.tvlUsd)}</span>
                                                <span className="text-[9px] md:text-xs text-muted-foreground">
                                                    {depositedUSD > 0 ? `Your: ${formatMoney(depositedUSD)}` : formatMoney(pool.tvlUsd)}
                                                </span>
                                            </div>

                                            <div
                                                className="ml-1 md:ml-4 flex-shrink-0 w-5 h-5 md:w-8 md:h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors group-hover:border-blue-500/50 group-hover:text-blue-500"
                                            >
                                                <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {earningsData.map((pool) => {
                        const protocolDisplay = getProtocolLabel(pool.project);
                        const protocolImg = getProtocolIcon(pool.project);

                        // Lookup position (Case-insensitive matching)
                        const userPosition = positionMap.get(`${pool.project}-${pool.symbol}`.toUpperCase());
                        const depositedUSD = userPosition ? userPosition.supplyUSD : 0;
                        const earnings = getEarningsForPool(pool, depositedUSD);

                        return (
                            <Card
                                key={`${pool.pool}-${pool.project}`}
                                className="bg-[#0f0f12] border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group overflow-hidden"
                                onClick={() => setSelectedPool(pool)}
                            >
                                <div className="p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <AssetIcon symbol={pool.symbol} className="w-10 h-10" />
                                                {protocolImg && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#0f0f12] bg-white overflow-hidden">
                                                        <img src={protocolImg} className="w-full h-full object-cover" alt={protocolDisplay} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg leading-tight">{pool.symbol}</h3>
                                                <p className="text-xs text-muted-foreground">{protocolDisplay}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">APY</div>
                                            <div className="font-mono text-xl font-bold text-blue-400">
                                                {pool.apy.toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-white/5">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">My Deposit</div>
                                            <div className="font-mono font-medium">{formatMoney(depositedUSD)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                {earnings.mode === 'tracked' ? 'Realized' : 'Est. Yearly'}
                                            </div>
                                            <div className="font-mono font-medium text-blue-400">
                                                {depositedUSD > 0
                                                    ? (earnings.mode === 'tracked' ? formatMoney(earnings.realizedUSD) : formatMoney(earnings.estimatedYearlyUSD))
                                                    : '-'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">TVL (USD)</div>
                                            <div className="font-mono font-medium">{formatMoney(pool.tvlUsd)}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs text-blue-500/80 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                            Low Risk
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {selectedPool && (() => {
                const posKey = `${selectedPool.project}-${selectedPool.symbol}`.toUpperCase();
                const pos = positionMap.get(posKey);
                return (
                    <MarketModal
                        isOpen={!!selectedPool}
                        onClose={handleClose}
                        initialMode="earn"
                        pool={{
                            ...selectedPool,
                            userDeposited: pos?.supply || 0,
                            userDepositedUSD: pos?.supplyUSD || 0,
                            userBorrowed: pos?.borrow || 0,
                            userBorrowedUSD: pos?.borrowUSD || 0,
                        }}
                    />
                );
            })()}
        </div>
    );
}

