'use client';

import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import { HandCoins, Wallet, Layers, Repeat } from 'lucide-react';

interface StrategyTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const TABS = [
    { id: 'Earn', label: 'Earn', icon: HandCoins },
    { id: 'Borrow', label: 'Borrow', icon: Wallet },
    { id: 'Multiply', label: 'Multiply', icon: Layers },
    { id: 'PayOff', label: 'Pay Off', icon: Repeat },
];

export function StrategyTabs({ activeTab, onTabChange }: StrategyTabsProps) {
    return (
        <div className="flex justify-center w-full">
            <div className="flex p-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm relative">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "relative px-6 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 z-10",
                                isActive ? "text-black" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-tab-pill"
                                    className="absolute inset-0 bg-[#CEFF00] rounded-full -z-10 shadow-[0_0_20px_rgba(206,255,0,0.3)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
