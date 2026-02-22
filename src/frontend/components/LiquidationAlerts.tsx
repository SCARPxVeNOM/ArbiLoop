'use client';

import { Bell, ShieldCheck, Siren, TrendingDown } from 'lucide-react';
import { Card } from "@/components/ui/card";

export function LiquidationAlerts() {
    return (
        <Card className="w-full bg-[#121216] border border-white/10 shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Bell className="text-[#3B82F6]" size={18} />
                    Active Alerts via Telegram
                </h3>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">System Online</span>
            </div>

            <div className="space-y-3">
                {/* Critical Alert */}
                <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg group hover:bg-red-500/15 transition-colors cursor-pointer">
                    <div className="mt-1">
                        <Siren className="text-red-500 animate-pulse" size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-red-400">Liquidation Approach</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            Your <span className="text-white">ETH collateral</span> on Aave is near threshold.
                        </div>
                        <div className="text-[10px] font-mono text-red-300 mt-1">HF: 1.05 (Danger)</div>
                    </div>
                </div>

                {/* Warning Alert */}
                <div className="flex gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg group hover:bg-orange-500/15 transition-colors cursor-pointer">
                    <div className="mt-1">
                        <TrendingDown className="text-orange-500" size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-orange-400">Market Volatility</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            High volatility detected in <span className="text-white">ETH Pair</span>.
                        </div>
                    </div>
                </div>

                {/* Info Alert */}
                <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                    <div className="mt-1">
                        <ShieldCheck className="text-blue-500" size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-blue-400">Safe Position</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            USDT Loop is healthy.
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-2 text-center">
                <button className="text-xs text-muted-foreground hover:text-[#3B82F6] underline decoration-dotted">View All Notifications</button>
            </div>
        </Card >
    );
}

