'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { HandCoins, Wallet, ShieldCheck, Zap, Info, ChevronRight, HelpCircle } from "lucide-react";

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-[#09090b] border-white/10 text-white p-0 overflow-hidden shadow-2xl">
                <div className="p-6 md:p-8 space-y-6">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[#3B82F6]/10 rounded-xl">
                                <HelpCircle className="w-6 h-6 text-[#3B82F6]" />
                            </div>
                            <DialogTitle className="text-2xl font-black tracking-tight">How it works</DialogTitle>
                        </div>
                        <DialogDescription className="text-muted-foreground text-left text-sm leading-relaxed">
                            ArbiLoop Lend is a smart yield intelligence suite that aggregates the best lending opportunities on Arbitrum.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Earn Section */}
                        <div className="group bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.05] hover:border-blue-500/20">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl mt-1">
                                    <HandCoins className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                        Earning Yield
                                        <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Deposit your idle assets into audited protocols like Aave and Radiant. Your assets earn interest from borrowers and protocol rewards.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Borrow Section */}
                        <div className="group bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.05] hover:border-blue-500/20">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl mt-1">
                                    <Wallet className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                        Borrowing Assets
                                        <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Use your deposited assets as collateral to borrow other tokens. Ensure your Health Factor stays high to avoid liquidation.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Safety Section */}
                        <div className="group bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.05] hover:border-[#3B82F6]/20">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-[#3B82F6]/10 rounded-xl mt-1">
                                    <ShieldCheck className="w-5 h-5 text-[#3B82F6]" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                        Safety First
                                        <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-[#3B82F6] transition-colors" />
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        We monitor protocol health in real-time. ArbiLoop helps you manage risk by providing a global health score and individual protocol alerts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl bg-[#3B82F6] text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                        >
                            Got it, thanks!
                        </button>
                    </div>
                </div>

                {/* Decorative bottom gradient */}
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-[#3B82F6] to-blue-500" />
            </DialogContent>
        </Dialog>
    );
}


