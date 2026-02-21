
'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, ShieldCheck, Copy, Check, Wallet, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Polling interval options
const POLLING_OPTIONS = [
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 360, label: "6 hours" },
    { value: 720, label: "12 hours" },
    { value: 960, label: "16 hours" },
    { value: 1440, label: "24 hours" },
];

export default function Settings() {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { toast } = useToast();

    const [telegramId, setTelegramId] = useState('');
    const [signature, setSignature] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [step, setStep] = useState(1);

    // Supabase State
    const [isLinked, setIsLinked] = useState<boolean | null>(null); // null = loading, false = disconnected, true = connected
    const [linkedUser, setLinkedUser] = useState<any>(null);
    const [isFetchingSettings, setIsFetchingSettings] = useState(false);

    // Settings state (Fetched from Supabase)
    const [pollingInterval, setPollingInterval] = useState(60);
    const [alertThreshold, setAlertThreshold] = useState(1.1);

    // Fetch user settings from Supabase when address changes
    useEffect(() => {
        const fetchUserSettings = async () => {
            if (!address) {
                setIsLinked(false);
                return;
            }

            setIsFetchingSettings(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('wallet_address', address.toLowerCase())
                    .single();

                if (error || !data) {
                    setIsLinked(false);
                    setLinkedUser(null);
                } else {
                    setIsLinked(true);
                    setLinkedUser(data);
                    setPollingInterval(data.polling_interval || 60);
                    setAlertThreshold(data.alert_threshold || 1.1);
                    console.log('User settings fetched:', data);
                }
            } catch (err) {
                console.error('Error fetching user settings:', err);
                setIsLinked(false);
            } finally {
                setIsFetchingSettings(false);
            }
        };

        if (isConnected) {
            fetchUserSettings();
        }
    }, [address, isConnected]);

    const handleSign = async () => {
        if (!telegramId) {
            toast({
                title: "Error",
                description: "Please enter your Telegram User ID first.",
                variant: "destructive"
            });
            return;
        }

        try {
            const message = `ArbiLoop Auth: ${telegramId}`;
            const sig = await signMessageAsync({ message });
            setSignature(sig);
            setStep(3);
            toast({
                title: "Signed Successfully",
                description: "Signature generated. Copy it and send to the bot.",
            });
        } catch (error) {
            console.error("Signing failed:", error);
            toast({
                title: "Signing Failed",
                description: "User rejected the signature request.",
                variant: "destructive"
            });
        }
    };

    const copySignature = () => {
        if (!signature) return;
        navigator.clipboard.writeText(`/verify ${signature}`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({
            title: "Copied!",
            description: "Command copied to clipboard. Paste it in Telegram.",
        });
    };

    // Helper to mask sensitive Telegram data
    const maskUserId = (id: string | number) => {
        const s = String(id);
        if (s.length <= 4) return s;
        return `${s.slice(0, 2)}**${s.slice(-2)}`;
    };

    const maskUsername = (name: string) => {
        if (!name) return 'User';
        if (name.length <= 4) return name;
        return `${name.slice(0, 2)}***${name.slice(-2)}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isConnected && (
                <div className="flex z-10 flex-col items-center justify-center p-12 text-center glass-card rounded-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                    <ShieldCheck className="w-16 h-16 text-primary/80 mb-6 drop-shadow-[0_0_15px_rgba(206,255,0,0.3)]" />
                    <h3 className="text-2xl font-bold font-outfit mb-3">Connect Wallet</h3>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Please connect your wallet securely to view your personalized dashboard and configure alerts.
                    </p>
                    <ConnectButton.Custom>
                        {({ openConnectModal, mounted }) => {
                            if (!mounted) return null;
                            return (
                                <Button
                                    onClick={openConnectModal}
                                    className="h-12 px-8 text-lg font-bold bg-[#CEFF00] text-black hover:bg-[#b8e600] rounded-full shadow-[0_0_20px_rgba(206,255,0,0.3)] transition-all hover:scale-105 flex items-center gap-2"
                                >
                                    Connect Wallet <Wallet className="h-5 w-5" />
                                </Button>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>
            )}

            {isConnected && (
                <>
                    <h1 className="text-3xl font-bold font-outfit bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
                        Settings & Alerts
                    </h1>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Telegram Linking Card */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Bell className="text-primary" />
                                        Telegram Link
                                    </div>
                                    {isLinked === true && (
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                            Linked to @{maskUsername(linkedUser?.username)}
                                        </Badge>
                                    )}
                                    {isLinked === false && (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                            Not Connected
                                        </Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    {isLinked
                                        ? "Your wallet is securely linked to Telegram for instant alerts."
                                        : "Link your Telegram account to receive instant liquidation alerts."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isFetchingSettings ? (
                                    <div className="space-y-4">
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : isLinked ? (
                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Connected User ID</span>
                                            <span className="font-mono text-foreground font-bold">{maskUserId(linkedUser?.chat_id)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Alerts Status</span>
                                            <span className={linkedUser?.alerts_enabled ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                                                {linkedUser?.alerts_enabled ? "Active" : "Paused"}
                                            </span>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="w-full h-9 bg-[#0088cc] hover:bg-[#0077b5] text-white border-none flex items-center gap-2"
                                            onClick={() => window.open('https://t.me/ArbiLoopBot', '_blank')}
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                                            </svg>
                                            Open Telegram Bot
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full text-xs h-8 border-dashed hover:bg-primary/10"
                                            onClick={() => {
                                                setIsLinked(false);
                                                setStep(1);
                                                setTelegramId('');
                                                setSignature('');
                                            }}
                                        >
                                            Link different account
                                        </Button>
                                        <p className="text-[10px] text-muted-foreground text-center pt-2">
                                            To permanently disconnect, send <code className="bg-secondary px-1 rounded">/disconnect</code> to the bot.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Step 1: Enter ID */}
                                        <div className={`transition-opacity duration-300 ${step === 1 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                            <label className="text-sm font-medium mb-1 block">1. Enter Telegram User ID</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="e.g. 123456789"
                                                    value={telegramId}
                                                    onChange={(e) => setTelegramId(e.target.value)}
                                                    className="font-mono"
                                                />
                                                <Button
                                                    variant="outline"
                                                    onClick={() => window.open('https://t.me/ArbiLoopBot', '_blank')}
                                                    className="shrink-0"
                                                >
                                                    Get ID
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 text-[10px]">
                                                Use <code className="bg-secondary px-1 rounded">/id</code> in the bot chat.
                                            </p>
                                        </div>

                                        {/* Step 2: Sign Message */}
                                        <div className={`transition-opacity duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-50'}`}>
                                            <label className="text-sm font-medium mb-1 block text-[12px]">2. Ownership Verify</label>
                                            <Button
                                                onClick={handleSign}
                                                className="w-full h-9 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 text-xs font-bold"
                                                disabled={!telegramId}
                                            >
                                                Sign Auth Message
                                            </Button>
                                        </div>

                                        {/* Step 3: Copy & Verify */}
                                        {signature && (
                                            <div className="p-3 rounded-lg bg-secondary/30 border border-border animate-in zoom-in-95">
                                                <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block text-emerald-400">3. Final Step</label>
                                                <div className="flex items-center gap-2 p-2 bg-background/50 rounded border border-border">
                                                    <code className="text-[10px] flex-1 break-all truncate font-mono text-muted-foreground">
                                                        /verify {signature.substring(0, 15)}...
                                                    </code>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copySignature}>
                                                        {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Polling Interval Card (Read-Only) */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="text-blue-400" />
                                    Polling Frequency
                                </CardTitle>
                                <CardDescription>
                                    How often your Agent checks your positions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-primary/20">
                                        <span className="text-sm font-medium">Active Interval</span>
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-sm py-1 px-3">
                                            Every {POLLING_OPTIONS.find(o => o.value === pollingInterval)?.label || `${pollingInterval} mins`}
                                        </Badge>
                                    </div>
                                    <div className="p-3 rounded bg-secondary/20 border border-border flex items-start gap-2">
                                        <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
                                        <p className="text-[10px] leading-tight text-muted-foreground">
                                            Managed via Telegram. Use <code className="bg-secondary px-1 rounded">/setinterval</code> to change.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Alert Threshold Card (Read-Only) */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="text-orange-500" />
                                    Risk Thresholds
                                </CardTitle>
                                <CardDescription>
                                    Your Agent's trigger points for notifications.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">

                                    {/* Health Factor Threshold */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Liquidation Alert at HF &lt;</span>
                                            <span className="font-mono font-bold text-orange-500">{alertThreshold.toFixed(1)}</span>
                                        </div>
                                        <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                                style={{ width: `${((alertThreshold - 1.0) / 1.0) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>1.0 (High Risk)</span>
                                            <span>2.0 (Safe)</span>
                                        </div>
                                    </div>

                                    {/* Monitoring Toggles Status */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded bg-secondary/10 border border-border flex flex-col gap-2">
                                            <span className="text-xs text-muted-foreground">Liquidation Alerts</span>
                                            <div className="flex items-center gap-2">
                                                {linkedUser?.alerts_enabled
                                                    ? <><Check className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-500">Active</span></>
                                                    : <><span className="text-sm font-bold text-muted-foreground">Disabled</span></>
                                                }
                                            </div>
                                        </div>
                                        <div className="p-3 rounded bg-secondary/10 border border-border flex flex-col gap-2">
                                            <span className="text-xs text-muted-foreground">Daily Briefing</span>
                                            <div className="flex items-center gap-2">
                                                {linkedUser?.daily_updates_enabled
                                                    ? <><Check className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-500">Active</span></>
                                                    : <><span className="text-sm font-bold text-muted-foreground">Disabled</span></>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded bg-secondary/20 border border-border flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] leading-tight text-muted-foreground">
                                            Use <code className="bg-secondary px-1 rounded">/setalert</code> or <code className="bg-secondary px-1 rounded">/togglealerts</code> in Telegram to configure.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info Card */}
                        <Card className="glass-card border-primary/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-500" />
                                    How It Works
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p>
                                    <strong className="text-foreground">24/7 AI Guardian:</strong> Your Agent monitors the blockchain while you sleep, ensuring you never miss a critical liquidation risk.
                                </p>
                                <p>
                                    <strong className="text-foreground">Sleep Peacefully:</strong> Get daily briefings and instant alerts so you can relax knowing your portfolio is watched.
                                </p>
                                <p>
                                    <strong className="text-foreground">Secure & Anonymous:</strong> This dashboard is read-only for your privacy. All critical actions (configuration, alerts) are handled securely via your private Telegram chat.
                                </p>
                                <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                                    <p className="text-xs">
                                        🔒 <strong>Security:</strong> We never ask for private keys. All on-chain transactions must be signed by your wallet.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

