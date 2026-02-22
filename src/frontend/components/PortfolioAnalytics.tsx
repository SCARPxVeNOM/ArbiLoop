'use client';

import { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    Activity,
    AlertTriangle,
    ArrowDownCircle,
    ArrowUpCircle,
    ExternalLink,
    RefreshCw,
    ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatMoney } from '@/lib/utils';
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';
import { useHistoricalPnl } from '@/hooks/useHistoricalPnl';
import { ActivityRecord, ActivityAction } from '@/lib/activity';
import { YieldData } from '@/hooks/useYields';
import { getProtocolLabel } from '@/lib/protocols';

type HistoryRange = '24h' | '7d' | '30d';

export interface DashboardPosition {
    protocol: string;
    symbol: string;
    supply: number;
    supplyUSD: number;
    borrow: number;
    borrowUSD: number;
}

interface QuickActionPayload {
    pool: Record<string, unknown>;
    mode: 'earn' | 'borrow';
    tab: 'deposit' | 'repay';
}

interface PortfolioAnalyticsProps {
    address?: `0x${string}`;
    isLoading: boolean;
    totalNetWorthUsd: number;
    totalSupplyUsd: number;
    totalBorrowUsd: number;
    overallHealthFactor: number;
    positions: DashboardPosition[];
    yields: YieldData[];
    onTriggerQuickAction: (payload: QuickActionPayload) => void;
}

function normalizeSymbol(symbol: string) {
    const upper = symbol.toUpperCase();
    if (upper === 'WETH') return 'ETH';
    return upper;
}

function formatXAxis(ts: number, range: HistoryRange) {
    const date = new Date(ts);
    if (range === '24h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTimelineDate(ts: number) {
    const date = new Date(ts);
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function actionLabel(action: ActivityAction) {
    switch (action) {
        case 'deposit':
            return 'Deposit';
        case 'withdraw':
            return 'Withdraw';
        case 'borrow':
            return 'Borrow';
        case 'repay':
            return 'Repay';
        case 'leverage':
            return 'Loop';
        default:
            return action;
    }
}

function actionIcon(action: ActivityAction) {
    if (action === 'deposit' || action === 'repay') return ArrowUpCircle;
    if (action === 'withdraw' || action === 'borrow') return ArrowDownCircle;
    return Activity;
}

function statusClass(status: ActivityRecord['status']) {
    if (status === 'confirmed') return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    if (status === 'failed') return 'text-red-400 border-red-500/30 bg-red-500/10';
    return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
}

const FALLBACK_CHART_TIMESTAMP = Date.UTC(2024, 0, 1);

export function PortfolioAnalytics({
    address,
    isLoading,
    totalNetWorthUsd,
    totalSupplyUsd,
    totalBorrowUsd,
    overallHealthFactor,
    positions,
    yields,
    onTriggerQuickAction,
}: PortfolioAnalyticsProps) {
    const [range, setRange] = useState<HistoryRange>('7d');
    const rangeDays = range === '24h' ? 1 : range === '7d' ? 7 : 30;
    const { history } = usePortfolioHistory({
        totalNetWorthUsd,
        totalSupplyUsd,
        totalBorrowUsd,
        healthFactor: Number.isFinite(overallHealthFactor) ? overallHealthFactor : 10,
        isEnabled: !!address && !isLoading
    });
    const { records } = useActivityTimeline();
    const { data: historicalPnl, isLoading: isHistoricalPnlLoading } = useHistoricalPnl({
        walletAddress: address,
        days: rangeDays,
        enabled: !!address && !isLoading
    });

    const healthChartData = useMemo(() => {
        const latestTimestamp = history.length > 0
            ? history[history.length - 1].timestamp
            : FALLBACK_CHART_TIMESTAMP;
        const windowMs =
            range === '24h'
                ? 24 * 60 * 60 * 1000
                : range === '7d'
                    ? 7 * 24 * 60 * 60 * 1000
                    : 30 * 24 * 60 * 60 * 1000;
        const cutoff = latestTimestamp - windowMs;

        const points = history.filter((point) => point.timestamp >= cutoff);
        const seeded =
            points.length > 0
                ? points
                : [
                    {
                        timestamp: latestTimestamp,
                        netWorthUsd: totalNetWorthUsd,
                        totalSupplyUsd,
                        totalBorrowUsd,
                        healthFactor: Number.isFinite(overallHealthFactor) ? overallHealthFactor : 10
                    }
                ];

        return seeded.map((point) => ({
            timestamp: point.timestamp,
            label: formatXAxis(point.timestamp, range),
            netWorthUsd: point.netWorthUsd,
            healthFactor: point.healthFactor,
        }));
    }, [history, overallHealthFactor, range, totalBorrowUsd, totalNetWorthUsd, totalSupplyUsd]);

    const hasIndexedPnl = Boolean(historicalPnl?.indexed && (historicalPnl.points?.length || 0) > 0);

    const pnlChartData = useMemo(() => {
        if (hasIndexedPnl && historicalPnl) {
            const depositedBase = Math.max(historicalPnl.summary?.totalDepositedUsd || 0, 1);
            return historicalPnl.points.map((point) => {
                const timestamp = new Date(`${point.day}T00:00:00.000Z`).getTime();
                return {
                    timestamp,
                    label: formatXAxis(timestamp, range),
                    pnlUsd: point.cumulativeRealizedUsd,
                    netWorthUsd: depositedBase,
                };
            });
        }

        const baseline = healthChartData[0]?.netWorthUsd ?? totalNetWorthUsd;
        return healthChartData.map((point) => ({
            timestamp: point.timestamp,
            label: point.label,
            pnlUsd: point.netWorthUsd - baseline,
            netWorthUsd: point.netWorthUsd,
        }));
    }, [hasIndexedPnl, healthChartData, historicalPnl, range, totalNetWorthUsd]);

    const pnlSummary = useMemo(() => {
        const first = pnlChartData[0];
        const last = pnlChartData[pnlChartData.length - 1];
        if (!first || !last) return { usd: 0, pct: 0 };

        const usd = last.pnlUsd - first.pnlUsd;
        const pctBase = hasIndexedPnl
            ? Math.max(historicalPnl?.summary?.totalDepositedUsd || 0, 1)
            : Math.max(first.netWorthUsd, 1);
        const pct = (usd / pctBase) * 100;
        return { usd, pct };
    }, [hasIndexedPnl, historicalPnl?.summary?.totalDepositedUsd, pnlChartData]);

    const quickActions = useMemo(() => {
        const findPoolForPosition = (position: DashboardPosition | undefined) => {
            if (!position) return null;
            return yields.find((pool) => {
                return (
                    pool.project === position.protocol &&
                    normalizeSymbol(pool.symbol) === normalizeSymbol(position.symbol)
                );
            });
        };

        const topDebt = [...positions]
            .filter((position) => position.borrowUSD > 1)
            .sort((a, b) => b.borrowUSD - a.borrowUSD)[0];
        const topCollateral = [...positions]
            .filter((position) => position.supplyUSD > 1)
            .sort((a, b) => b.supplyUSD - a.supplyUSD)[0];

        const debtPool = findPoolForPosition(topDebt);
        const collateralPool = findPoolForPosition(topCollateral);

        const actions: Array<{
            id: string;
            title: string;
            subtitle: string;
            tone: 'danger' | 'neutral';
            payload: QuickActionPayload;
        }> = [];

        if (topDebt && debtPool) {
            actions.push({
                id: 'repay-top-debt',
                title: `Repay ${topDebt.symbol} Debt`,
                subtitle: `${formatMoney(topDebt.borrowUSD)} on ${getProtocolLabel(topDebt.protocol)}`,
                tone: 'danger',
                payload: {
                    mode: 'borrow',
                    tab: 'repay',
                    pool: {
                        ...debtPool,
                        userBorrowed: topDebt.borrow,
                        userBorrowedUSD: topDebt.borrowUSD,
                        userDeposited: topDebt.supply,
                        userDepositedUSD: topDebt.supplyUSD,
                    }
                }
            });
        }

        if (topCollateral && collateralPool) {
            actions.push({
                id: 'add-collateral',
                title: `Add ${topCollateral.symbol} Collateral`,
                subtitle: `${formatMoney(topCollateral.supplyUSD)} on ${getProtocolLabel(topCollateral.protocol)}`,
                tone: 'neutral',
                payload: {
                    mode: 'earn',
                    tab: 'deposit',
                    pool: {
                        ...collateralPool,
                        userBorrowed: topCollateral.borrow,
                        userBorrowedUSD: topCollateral.borrowUSD,
                        userDeposited: topCollateral.supply,
                        userDepositedUSD: topCollateral.supplyUSD,
                    }
                }
            });
        }

        return actions;
    }, [positions, yields]);

    const timeline = useMemo(() => records.slice(0, 8), [records]);
    const isAtRisk = Number.isFinite(overallHealthFactor) && overallHealthFactor > 0 && overallHealthFactor < 1.2;

    return (
        <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2 bg-[#0A0A0B] border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle className="text-lg md:text-xl">Historical PnL & Health</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {hasIndexedPnl
                                    ? 'On-chain realized PnL from indexed Aave/Radiant events'
                                    : 'Wallet-based performance snapshots from live portfolio metrics'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {(['24h', '7d', '30d'] as HistoryRange[]).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setRange(key)}
                                    className={cn(
                                        'h-8 rounded-md px-3 text-xs font-bold uppercase tracking-wide transition-colors',
                                        range === key
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-white/5 text-muted-foreground border border-white/10 hover:text-white'
                                    )}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase text-muted-foreground">Current Net Worth</div>
                            <div className="text-lg font-bold text-white">{formatMoney(totalNetWorthUsd)}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase text-muted-foreground">
                                {hasIndexedPnl ? 'Realized PnL' : 'Range PnL'}
                            </div>
                            <div className={cn('text-lg font-bold', pnlSummary.usd >= 0 ? 'text-blue-400' : 'text-red-400')}>
                                {pnlSummary.usd >= 0 ? '+' : ''}{formatMoney(pnlSummary.usd)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase text-muted-foreground">PnL %</div>
                            <div className={cn('text-lg font-bold', pnlSummary.pct >= 0 ? 'text-blue-400' : 'text-red-400')}>
                                {pnlSummary.pct >= 0 ? '+' : ''}{pnlSummary.pct.toFixed(2)}%
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase text-muted-foreground">Health Factor</div>
                            <div className={cn(
                                'text-lg font-bold',
                                overallHealthFactor >= 1.5 ? 'text-blue-400' : overallHealthFactor >= 1.2 ? 'text-amber-400' : 'text-red-400'
                            )}>
                                {Number.isFinite(overallHealthFactor) ? overallHealthFactor.toFixed(2) : 'N/A'}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-[220px] rounded-2xl border border-white/10 bg-[#08080a] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                <span>{hasIndexedPnl ? 'Realized PnL Trend' : 'PnL Trend'}</span>
                                <span className={cn(
                                    'rounded-full border px-2 py-0.5 text-[9px] font-bold',
                                    hasIndexedPnl
                                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                        : 'border-white/20 bg-white/5 text-muted-foreground'
                                )}>
                                    {hasIndexedPnl ? 'INDEXED' : (isHistoricalPnlLoading ? 'INDEXING' : 'LOCAL')}
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pnlChartData}>
                                    <defs>
                                        <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.45} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value)} width={70} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
                                        formatter={(value: number | undefined) => [formatMoney(value ?? 0), hasIndexedPnl ? 'Realized PnL' : 'PnL']}
                                        labelFormatter={(label) => `${label}`}
                                    />
                                    <Area type="monotone" dataKey="pnlUsd" stroke="#3B82F6" strokeWidth={2} fill="url(#pnlFill)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="h-[220px] rounded-2xl border border-white/10 bg-[#08080a] p-3">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Health Trend</div>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={healthChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0.8, 'dataMax + 0.5']} width={45} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
                                        formatter={(value: number | undefined) => [(value ?? 0).toFixed(2), 'Health']}
                                        labelFormatter={(label) => `${label}`}
                                    />
                                    <Line type="monotone" dataKey="healthFactor" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                {isAtRisk ? <ShieldAlert className="h-4 w-4 text-red-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}
                                <span>{isAtRisk ? 'Risk Elevated' : 'Risk Controls'}</span>
                            </div>
                            <span className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                                isAtRisk ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                            )}>
                                {isAtRisk ? 'Fix Risk Now' : 'Ready'}
                            </span>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {quickActions.map((action) => (
                                <Button
                                    key={action.id}
                                    onClick={() => onTriggerQuickAction(action.payload)}
                                    className={cn(
                                        'justify-between rounded-xl border px-3 py-2 text-left h-auto',
                                        action.tone === 'danger'
                                            ? 'border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                                            : 'border-blue-500/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20'
                                    )}
                                >
                                    <span className="flex flex-col items-start">
                                        <span className="text-sm font-bold">{action.title}</span>
                                        <span className="text-[11px] opacity-80">{action.subtitle}</span>
                                    </span>
                                    {action.tone === 'danger' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Activity className="h-4 w-4 shrink-0" />}
                                </Button>
                            ))}
                            {quickActions.length === 0 && (
                                <div className="text-xs text-muted-foreground md:col-span-2">
                                    No active debt/collateral positions found for instant risk actions.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-[#0A0A0B] border-white/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Transaction Timeline</CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Recent on-app transactions for this wallet
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!address && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                            Connect your wallet to view timeline activity.
                        </div>
                    )}

                    {address && timeline.length === 0 && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                            No transactions recorded yet. New deposits, borrows, repays, and loops will appear here.
                        </div>
                    )}

                    {timeline.map((record) => {
                        const Icon = actionIcon(record.action);
                        const protocolLabel = getProtocolLabel(record.protocol);

                        return (
                            <div key={record.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                        <Icon className="mt-0.5 h-4 w-4 text-white/70" />
                                        <div>
                                            <div className="text-sm font-semibold text-white">
                                                {actionLabel(record.action)} {record.asset}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">{protocolLabel} - {formatTimelineDate(record.createdAt)}</div>
                                        </div>
                                    </div>

                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', statusClass(record.status))}>
                                        {record.status}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <div className="text-muted-foreground">
                                        {typeof record.amount === 'number' ? `${record.amount.toFixed(4)} ${record.asset}` : '-'}
                                        {typeof record.amountUsd === 'number' ? ` (${formatMoney(record.amountUsd)})` : ''}
                                    </div>
                                    {record.explorerUrl && (
                                        <a
                                            href={record.explorerUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                        >
                                            View <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}

