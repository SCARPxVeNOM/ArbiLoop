import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, AlertTriangle, CloudOff, ShieldAlert } from 'lucide-react';

export default function TermsOfService() {
    const currentYear = new Date().getFullYear();

    return (
        <main className="min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
            {/* Background Gradients (Distinct from Privacy Policy slightly, or same theme) */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#3B82F6]/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 pt-32 pb-20 container max-w-4xl mx-auto px-6">

                {/* Back Button */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-[#3B82F6] transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>
                </div>

                {/* Header */}
                <div className="mb-12 border-b border-white/10 pb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-xs font-bold tracking-wide uppercase">
                        <Scale size={12} />
                        Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold font-outfit mb-4">Terms of Service</h1>
                    <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                        Please read these terms carefully before using the ArbiLoop platform. By accessing or using our services, you agree to be bound by these terms.
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-12">

                    {/* Section 1 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                                <span className="font-bold">1</span>
                            </div>
                            Acceptance of Terms
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                ArbiLoop ("we," "our," or "us") provides a web-based interface that allows you to interact with decentralized finance (DeFi) protocols on the Arbitrum.
                            </p>
                            <p className="mt-4">
                                By clicking "Connect Wallet", creating a strategy, or using any feature of the platform, you acknowledge that you have read, understood, and agreed to these Terms of Service. If you do not agree, you must not use the platform.
                            </p>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section>
                        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 mb-8">
                            <h2 className="text-xl font-bold font-outfit mb-3 text-red-400 flex items-center gap-2">
                                <AlertTriangle size={20} />
                                Risk Disclosure
                            </h2>
                            <div className="text-muted-foreground text-sm space-y-2">
                                <p>
                                    Cryptocurrency and DeFi investments carry a high degree of risk. ArbiLoop is a tool for interacting with smart contracts, but we do not manage your funds or guarantee returns.
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground/80">
                                    <li><strong>Smart Contract Risk:</strong> Underlying protocols (Aave, Radiant, etc.) may have bugs or vulnerabilities.</li>
                                    <li><strong>Liquidation Risk:</strong> Market volatility can lead to liquidation of your collateral. While ArbiLoop provides monitoring tools, we are not responsible for losses due to liquidation.</li>
                                    <li><strong>Impermanent Loss:</strong> Providing liquidity to pools may result in impermanent loss.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                                <CloudOff size={18} />
                            </div>
                            3. Non-Custodial Nature
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                ArbiLoop is a non-custodial platform. We do not have access to your private keys, funds, or ability to initiate transactions without your signature. You are solely responsible for the security of your wallet and private keys.
                            </p>
                            <p className="mt-4">
                                We cannot recover your funds if you lose access to your wallet or if you approve a malicious transaction on a third-party site.
                            </p>
                        </div>
                    </section>

                    {/* Section 4 */}
                    <section>
                        <h2 className="text-2xl font-bold font-outfit mb-4 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                                <ShieldAlert size={18} />
                            </div>
                            4. Limitation of Liability
                        </h2>
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground max-w-none pl-11">
                            <p>
                                To the maximum extent permitted by law, ArbiLoop and its developers shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to damages for loss of profits, goodwill, use, data, or other intangible losses.
                            </p>
                            <p className="mt-4">
                                This includes losses resulting from: (i) the use or inability to use the service; (ii) cost of procurement of substitute goods and services; (iii) unauthorized access to or alteration of your transmissions or data.
                            </p>
                        </div>
                    </section>

                    <div className="pt-8 border-t border-white/10 mt-12 text-center">
                        <p className="text-xs text-muted-foreground/60 mt-4">
                            &copy; {currentYear} ArbiLoop. All rights reserved.
                        </p>
                    </div>

                </div>
            </div>
        </main>
    );
}


