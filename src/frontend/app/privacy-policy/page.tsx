import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Eye, Server } from 'lucide-react';

export default function PrivacyPolicy() {
    const currentYear = new Date().getFullYear();

    return (
        <main className="min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#CEFF00]/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 pt-32 pb-20 container max-w-4xl mx-auto px-6">

                {/* Back Button */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-[#CEFF00] transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>
                </div>

                {/* Header */}
                <div className="mb-12 border-b border-white/10 pb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#CEFF00]/10 border border-[#CEFF00]/20 text-[#CEFF00] text-xs font-bold tracking-wide uppercase">
                        <ShieldCheck size={12} />
                        Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold font-outfit mb-4">Privacy Policy</h1>
                    <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                        We value your privacy. ArbiLoop is a non-custodial platform designed to keep you in control of your data and your assets.
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-12">

                    {/* Section 1 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#CEFF00]/10 flex items-center justify-center text-[#CEFF00]">
                                <Lock size={18} />
                            </div>
                            1. Data Collection
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                ArbiLoop prioritizes user privacy. As a non-custodial decentralized finance (DeFi) interface, we do not require you to create an account with personal information such as your name, email address, or phone number.
                            </p>
                            <p className="mt-4">
                                However, to provide our services, we may interact with the following data:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li><strong>Public Wallet Addresses:</strong> We may collect and read your public wallet address to display your balances and portfolio performance.</li>
                                <li><strong>Blockchain Data:</strong> Transaction history and token balances associated with your wallet address are public information on the blockchain.</li>
                                <li><strong>Usage Data:</strong> We may collect anonymous analytics data (e.g., page views, session duration) to improve platform performance and user experience.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#CEFF00]/10 flex items-center justify-center text-[#CEFF00]">
                                <Eye size={18} />
                            </div>
                            2. How We Use Your Data
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                The limited data we collect is used strictly for operational purposes:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>To provide real-time portfolio tracking and health factor monitoring.</li>
                                <li>To facilitate interactions with third-party DeFi protocols (e.g., Aave, Kinza, Radiant).</li>
                                <li>To send you alerts via our Telegram bot (only if you explicitly opt-in and link your wallet).</li>
                                <li>To identify and resolve technical issues or bugs.</li>
                            </ul>
                            <p className="mt-4">
                                <strong>We do not sell, rent, or trade your personal data or wallet information to any third parties.</strong>
                            </p>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#CEFF00]/10 flex items-center justify-center text-[#CEFF00]">
                                <Server size={18} />
                            </div>
                            3. Third-Party Services
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                ArbiLoop acts as an interface to decentralized protocols. When you use our platform, you may interact with third-party services, including:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li><strong>RPC Providers:</strong> Nodes that facilitate communication with the blockchain.</li>
                                <li><strong>Wallet Providers:</strong> MetaMask, TrustWallet, or other Web3 wallets.</li>
                                <li><strong>DeFi Protocols:</strong> Smart contracts governing lending and borrowing (e.g., Aave, Radiant).</li>
                            </ul>
                            <p className="mt-4">
                                We encourage you to review the privacy policies of these third-party services, as ArbiLoop has no control over their data practices.
                            </p>
                        </div>
                    </section>

                    <div className="pt-8 border-t border-white/10 mt-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            If you have any questions about this Privacy Policy, please contact us via our community channels.
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-4">
                            &copy; {currentYear} ArbiLoop. All rights reserved.
                        </p>
                    </div>

                </div>
            </div>
        </main>
    );
}

