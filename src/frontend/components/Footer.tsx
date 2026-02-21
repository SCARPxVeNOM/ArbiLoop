'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Send } from 'lucide-react';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/ArbiLoopBot';

const Footer = () => {
    // Current year for copyright
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full border-t border-white/5 bg-[#0B0B0F] pt-24 pb-32 md:pb-12 mt-24 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

            <div className="container max-w-screen-2xl mx-auto px-4 md:px-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">

                    {/* Brand Column */}
                    <div className="col-span-1 md:col-span-2 space-y-6 md:pr-12">
                        <Link href="/" className="flex items-center gap-3 w-fit">
                            <div className="relative h-8 w-8">
                                <Image
                                    src="/ArbiLoop.png"
                                    alt="ArbiLoop Logo"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="font-outfit font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
                                ArbiLoop
                            </span>
                        </Link>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                            Advanced DeFi automation on Arbitrum. Maximize your yields with automated loop strategies and real-time risk management.
                            Non-custodial, secure, and built for performance.
                        </p>
                    </div>

                    {/* Navigation Column */}
                    <div className="col-span-1">
                        <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-wider opacity-70">Platform</h4>
                        <ul className="space-y-4">
                            <li>
                                <Link href="/dashboard" className="text-muted-foreground hover:text-white transition-colors text-sm">Dashboard</Link>
                            </li>
                            <li>
                                <Link href="/lend" className="text-muted-foreground hover:text-white transition-colors text-sm">Lend & Strategy</Link>
                            </li>
                            <li>
                                <Link href="/portfolio" className="text-muted-foreground hover:text-white transition-colors text-sm">Portfolio Management</Link>
                            </li>
                            <li>
                                <Link href="/settings" className="text-muted-foreground hover:text-white transition-colors text-sm">Settings & Alerts</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Socials Column */}
                    <div className="col-span-1">
                        <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-wider opacity-70">Community</h4>
                        <div className="flex flex-col gap-4">
                            <a
                                href="https://x.com/Arbitrum"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 text-muted-foreground hover:text-white transition-colors group w-fit"
                            >
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-white/20 group-hover:bg-white/10 transition-all">
                                    {/* X Logo SVG (Simple) */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </div>
                                <span className="text-sm">Follow on X</span>
                            </a>

                            <a
                                href={TELEGRAM_BOT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 text-muted-foreground hover:text-[#2AABEE] transition-colors group w-fit"
                            >
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#2AABEE]/30 group-hover:bg-[#2AABEE]/10 transition-all">
                                    <Send size={14} className="ml-0.5" />
                                </div>
                                <span className="text-sm">Telegram Bot</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-muted-foreground/60">
                        &copy; {currentYear} ArbiLoop. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
                        <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-white transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms-of-service" className="text-xs text-muted-foreground hover:text-white transition-colors">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export { Footer };

