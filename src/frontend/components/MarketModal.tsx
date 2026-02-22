"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Loader2 } from "lucide-react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { EarnModalContent } from "./EarnModal";
import { BorrowModalContent } from "./BorrowModal";

interface MarketModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode: "earn" | "borrow";
    pool: any;
    initialTab?: "deposit" | "withdraw" | "borrow" | "repay";
}

export function MarketModal({ isOpen, onClose, initialMode, pool, initialTab }: MarketModalProps) {
    const [mode, setMode] = useState<"earn" | "borrow">(initialMode);
    const [isSwitching, setIsSwitching] = useState(false);

    // Sync mode if initialMode changes while open (unlikely but good for safety)
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);

    const handleModeSwitch = (newMode: "earn" | "borrow") => {
        if (newMode === mode) return;
        setIsSwitching(true);
        setMode(newMode);
        // Artificial delay for smooth transition and re-fetching simulation
        setTimeout(() => setIsSwitching(false), 300);
    };

    const protocolDisplay = pool.project === 'aave-v3' ? 'Aave V3' : 'Radiant';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-[420px] h-[90vh] md:h-auto md:max-h-[90vh] bg-[#09090b] border-white/10 text-white p-0 gap-0 rounded-3xl overflow-hidden flex flex-col">
                <div className="sr-only">
                    <DialogTitle>{pool.symbol} Market - {protocolDisplay}</DialogTitle>
                </div>
                {/* Unified Header */}
                <div className="p-4 md:p-6 pb-3 md:pb-4 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 md:gap-3">
                            <div className="relative">
                                <AssetIcon symbol={pool.symbol} className="w-9 h-9 md:w-11 md:h-11 shadow-2xl" />
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full border border-white/20 flex items-center justify-center p-0.5 z-10 shadow-lg",
                                    pool.project === 'aave-v3' ? "bg-[#F0B90B]" : "bg-[#A855F7]"
                                )}>
                                    <img
                                        src={pool.project === 'aave-v3' ? '/aave.png' : '/radiant.jpeg'}
                                        className="w-full h-full object-contain rounded-full"
                                        alt={protocolDisplay}
                                    />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">{pool.symbol}</h2>
                                <div className="flex items-center gap-1.5 text-[9px] md:text-xs text-muted-foreground/60 font-bold uppercase tracking-widest">
                                    <span>{protocolDisplay}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 md:gap-3">
                            {/* Mode Toggle */}
                            <div className="flex items-center bg-black/40 p-1 rounded-full border border-white/5 shadow-inner">
                                <button
                                    onClick={() => handleModeSwitch("earn")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black transition-all lowercase italic",
                                        mode === "earn"
                                            ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                            : "text-muted-foreground hover:text-white"
                                    )}
                                >
                                    Supply
                                </button>
                                <button
                                    onClick={() => handleModeSwitch("borrow")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black transition-all lowercase italic",
                                        mode === "borrow"
                                            ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                            : "text-muted-foreground hover:text-white"
                                    )}
                                >
                                    Borrow
                                </button>
                            </div>

                            <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-muted-foreground hover:text-white group">
                                <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {isSwitching ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex-1 flex flex-col items-center justify-center gap-3"
                            >
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground animate-pulse font-medium">Updating Market Data...</span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={mode}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col min-h-0"
                            >
                                {mode === "earn" ? (
                                    <EarnModalContent
                                        pool={pool}
                                        onClose={onClose}
                                        isEmbedded={true}
                                        initialTab={initialTab === 'withdraw' ? 'withdraw' : 'deposit'}
                                    />
                                ) : (
                                    <BorrowModalContent
                                        pool={pool}
                                        onClose={onClose}
                                        isEmbedded={true}
                                        initialTab={initialTab === 'repay' ? 'repay' : 'borrow'}
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}
