'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function MobileBottomNav() {
    const pathname = usePathname();

    const tabs = [
        {
            name: 'Home',
            href: '/dashboard',
            icon: LayoutDashboard,
            // Match /dashboard or root if dashboard is default, but here strictly /dashboard
            isActive: (path: string) => path === '/dashboard' || path === '/'
        },
        {
            name: 'Lend',
            href: '/lend',
            icon: Wallet,
            isActive: (path: string) => path.startsWith('/lend')
        },
        {
            name: 'Portfolio',
            href: '/portfolio',
            icon: PieChart,
            isActive: (path: string) => path.startsWith('/portfolio')
        },
        {
            name: 'Settings',
            href: '/settings',
            icon: Settings,
            isActive: (path: string) => path.startsWith('/settings')
        }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#09090b]/80 backdrop-blur-xl border-t border-white/10 pb-safe">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => {
                    const isActive = tab.isActive(pathname);
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className="relative flex flex-col items-center justify-center w-full h-full"
                        >
                            {isActive && (
                                <motion.div
                                    className="absolute -top-[1px] w-12 h-[2px] bg-[#CEFF00] shadow-[0_0_10px_#CEFF00]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                />
                            )}

                            <div className={cn(
                                "flex flex-col items-center gap-1 transition-colors duration-200",
                                isActive ? "text-[#CEFF00]" : "text-muted-foreground hover:text-white"
                            )}>
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-medium">{tab.name}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
