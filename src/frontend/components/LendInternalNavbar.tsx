'use client';


import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import { HandCoins, Wallet, Layers, Repeat } from 'lucide-react';

const TABS = [
    { id: 'earn', label: 'Earn', href: '/lend/earn', icon: HandCoins },
    { id: 'borrow', label: 'Borrow', href: '/lend/borrow', icon: Wallet },
    { id: 'strategy', label: 'Strategy', href: '/lend/strategy', icon: Layers },
];

export function LendInternalNavbar() {
    const pathname = usePathname();

    return (
        <div className="flex justify-center items-center w-full h-16 mb-2">
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm relative w-full max-w-2xl md:w-auto md:flex md:gap-0">
                {TABS.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <a
                            key={tab.id}
                            href={tab.href}
                            className={cn(
                                "relative px-1 md:px-6 py-2 rounded-full text-[10px] md:text-sm font-bold transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 z-10 text-center leading-none",
                                isActive ? "text-black" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-lend-pill"
                                    className="absolute inset-0 bg-[#CEFF00] rounded-full -z-10 shadow-[0_0_20px_rgba(206,255,0,0.3)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <tab.icon className="w-3 h-3 md:w-4 md:h-4" />
                            <span className="truncate w-full">{tab.label}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
