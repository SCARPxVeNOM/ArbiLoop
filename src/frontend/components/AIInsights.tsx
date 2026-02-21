'use client';

import { useEffect, useState, useRef } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from 'wagmi';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Button } from "@/components/ui/button";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

interface AIInsightsProps {
    portfolioData: any;
    isLoading?: boolean;
}

const CACHE_KEY_PREFIX = 'ArbiLoop_ai_insights_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minute cache for stability

const LOADING_MESSAGES = [
    "Fetching your protocol positions...",
    "Syncing market data from Arbitrum...",
    "Calculating individual Health Factors...",
    "Analyzing debt-to-collateral ratios...",
    "Scanning for yield optimization paths...",
    "Generating safety recommendations...",
    "Finalizing personalized AI insights..."
];

export function AIInsights({ portfolioData, isLoading: isParentLoading }: AIInsightsProps) {
    const { address } = useAccount();
    const [tips, setTips] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use refs to track the last analyzed data and session status
    const lastAnalyzedData = useRef<string>("");
    const hasFetchedThisSession = useRef<boolean>(false);
    const [messageIndex, setMessageIndex] = useState(0);

    const { settings, loading: settingsLoading } = useUserSettings();

    // Dynamic loading messages logic
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        if (loading || isParentLoading) {
            const cycleMessage = () => {
                const randomTime = Math.floor(Math.random() * (2500 - 1000 + 1) + 1000);
                timeoutId = setTimeout(() => {
                    setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
                    cycleMessage();
                }, randomTime);
            };
            cycleMessage();
        } else {
            setMessageIndex(0);
        }

        return () => clearTimeout(timeoutId);
    }, [loading, isParentLoading]);

    useEffect(() => {
        async function fetchInsights() {
            if (!address || !portfolioData || settingsLoading) return;

            // 1. Check for significant data (ignore empty/loading states)
            if (isParentLoading || settingsLoading) return;

            const hasData = (portfolioData.totalSupplied > 0 || portfolioData.totalBorrowed > 0);
            if (!hasData) return;

            // 2. Create a stable hash/string of the data to detect changes
            // We include the total values and the positions count/ids to catch major changes
            const currentDataString = JSON.stringify({
                totalNetWorth: portfolioData.totalNetWorth?.toFixed(2),
                totalSupplied: portfolioData.totalSupplied?.toFixed(2),
                totalBorrowed: portfolioData.totalBorrowed?.toFixed(2),
                positions: portfolioData.positions?.map((p: any) => p.symbol + p.supply + p.borrow).join(','),
                threshold: settings?.alert_threshold
            });

            // 3. Check Cache Freshness & Session Status
            const cacheKey = `${CACHE_KEY_PREFIX}${address}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const { timestamp, data, inputHash } = JSON.parse(cached);
                const isFresh = (Date.now() - timestamp) < CACHE_DURATION;
                const isSameData = inputHash === currentDataString;

                // If cache is fresh, use it and mark as fetched for this session
                if (isFresh) {
                    setTips(data);
                    lastAnalyzedData.current = currentDataString;
                    hasFetchedThisSession.current = true;
                    return;
                }

                // If we've already shown insights (fresh or not) and data hasn't changed, 
                // don't poll again while we are on this same page.
                if (hasFetchedThisSession.current && isSameData) {
                    return;
                }
            }

            // 4. Check if we just tried this exact data (prevent internal loops)
            if (lastAnalyzedData.current === currentDataString && !loading) {
                return;
            }

            // If we've already fetched ONCE this session, don't auto-poll again
            // unless the data actually changed (inputHash check above).
            if (hasFetchedThisSession.current && lastAnalyzedData.current === currentDataString) {
                return;
            }

            setLoading(true);
            setError(null);
            lastAnalyzedData.current = currentDataString; // Mark as processing

            try {
                const response = await fetch('/api/ai-insight', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        portfolio: portfolioData,
                        userSettings: settings
                    }),
                });

                if (!response.ok) throw new Error('Failed to fetch insights');

                const data = await response.json();
                setTips(data.tips);

                // Save to cache
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: data.tips,
                    inputHash: currentDataString
                }));
                hasFetchedThisSession.current = true;

            } catch (err) {
                console.error(err);
                setError("AI Agent is currently sleeping. Try again later.");
                // Reset ref so we can try again if data updates
                lastAnalyzedData.current = "";
            } finally {
                setLoading(false);
            }
        }

        fetchInsights();
    }, [address, portfolioData, settings, settingsLoading]); // Keep dependencies, but logic handles the loop

    // Manual Refresh Handler
    const handleRefresh = () => {
        if (!address) return;
        localStorage.removeItem(`${CACHE_KEY_PREFIX}${address}`);
        lastAnalyzedData.current = "";
        window.location.reload();
    };

    // Prompt to connect wallet if not connected
    if (!address) {
        return (
            <Card className="bg-[#0A0A0B] border-white/10 shadow-2xl relative overflow-hidden group min-h-[300px] flex flex-col items-center justify-center">
                {/* Background Glow Effects */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[120px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

                <CardContent className="relative z-10 py-12 flex flex-col items-center text-center space-y-8 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center border border-white/10 shadow-2xl rotate-3 group-hover:rotate-6 transition-transform duration-500">
                        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            Unlock AI-Driven Protection
                        </h2>
                        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                            Connect your wallet to enable 24/7 autonomous monitoring,
                            real-time risk alerts, and personalized yield optimization tips.
                        </p>
                    </div>

                    <ConnectButton.Custom>
                        {({ openConnectModal, mounted }) => {
                            if (!mounted) return null;
                            return (
                                <Button
                                    onClick={openConnectModal}
                                    size="lg"
                                    className="bg-primary text-black font-bold h-12 px-8 rounded-full shadow-[0_0_20px_rgba(206,255,0,0.2)] hover:shadow-[0_0_30px_rgba(206,255,0,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Wallet className="w-5 h-5" />
                                    Connect Wallet
                                </Button>
                            );
                        }}
                    </ConnectButton.Custom>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-[#CEFF00]/10 to-emerald-500/10 border-emerald-500/20 shadow-lg relative overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg font-outfit text-emerald-400">
                    <Sparkles className="w-5 h-5 text-[#CEFF00]" />
                    AI Risk Agent Insights
                </CardTitle>
                {tips.length > 0 && !loading && (
                    <button onClick={handleRefresh} className="text-xs text-emerald-500/50 hover:text-[#CEFF00] transition-colors" title="Force Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}
            </CardHeader>
            <CardContent>
                {loading || isParentLoading ? (
                    <div className="space-y-3 py-2">
                        <div className="flex items-center gap-3 text-muted-foreground mb-4">
                            <Loader2 className="w-4 h-4 animate-spin text-[#CEFF00]" />
                            <div className="overflow-hidden h-4">
                                <span
                                    key={messageIndex}
                                    className="text-xs uppercase font-bold tracking-widest block animate-in fade-in slide-in-from-bottom-1 duration-500"
                                >
                                    {isParentLoading ? "Syncing Portfolio..." : LOADING_MESSAGES[messageIndex]}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 w-full bg-white/5 animate-pulse rounded-lg border border-white/5" />
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={handleRefresh} className="text-xs underline text-muted-foreground hover:text-white text-left">Try Again</button>
                    </div>

                ) : tips.length > 0 ? (
                    <ul className="space-y-3">
                        {tips.map((tip, i) => (
                            <li key={i} className="flex gap-3 text-sm text-white/90 bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#CEFF00]/30 transition-colors">
                                <span className="text-[#CEFF00] font-bold min-w-[20px]">0{i + 1}</span>
                                <span className="leading-relaxed">{tip}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground italic">
                        No active positions found. Deposit assets to activate the AI Agent.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

