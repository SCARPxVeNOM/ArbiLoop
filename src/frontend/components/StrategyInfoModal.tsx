'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StrategyInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function StrategyInfoModal({ isOpen, onClose }: StrategyInfoModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] bg-[#0f0f12] border-white/10 text-white p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        <DialogTitle>How Strategy Loops Work</DialogTitle>
                    </div>
                    <DialogDescription>
                        Understanding the mechanics, benefits, and risks of leveraged yield farming.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <div className="p-6 pt-2">
                        <Tabs defaultValue="mechanics" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/5">
                                <TabsTrigger value="mechanics">Mechanics</TabsTrigger>
                                <TabsTrigger value="benefits">Benefits</TabsTrigger>
                                <TabsTrigger value="risks">Risks</TabsTrigger>
                            </TabsList>

                            <TabsContent value="mechanics" className="space-y-4">
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                            <span className="font-bold text-blue-500">1</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Initial Deposit</h4>
                                            <p className="text-sm text-muted-foreground">
                                                You supply a base asset (e.g., USDC) to a lending protocol. This serves as your initial collateral.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                            <span className="font-bold text-blue-500">2</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Borrow & Loop</h4>
                                            <p className="text-sm text-muted-foreground">
                                                ArbiLoop automatically borrows against your collateral, swaps it back to the supply asset, and re-deposits it.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                            <span className="font-bold text-blue-500">3</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm mb-1">Result: Multiplied Yield</h4>
                                            <p className="text-sm text-muted-foreground">
                                                This process repeats for the selected number of loops (e.g., 3x or 4x), significantly increasing the size of your earning position.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-xl border border-white/5 mt-4">
                                        <h4 className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
                                            <Layers className="w-4 h-4" /> Example: 3x Leverage
                                        </h4>
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Initial: $1,000</span>
                                            <span className="text-muted-foreground">-&gt;</span>
                                            <span className="font-bold text-primary">Position: $3,000</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            You earn yield on $3,000 while only paying interest on the borrowed portion.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="benefits" className="space-y-4">
                                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                                            <h3 className="font-bold text-emerald-400">Amplified APY</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Since your earning position is larger than your initial capital, the net APY is multiplied. If the supply APY is higher than the borrow APY, your returns effectively stack.
                                        </p>
                                    </div>

                                    <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Layers className="w-5 h-5 text-blue-400" />
                                            <h3 className="font-bold text-blue-400">Token Rewards</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Many protocols incentivize both borrowing and supplying. Loops allow you to farm these rewards on a much larger scale than a simple deposit.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="risks" className="space-y-4">
                                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                            <h3 className="font-bold text-red-500">Liquidation Risk</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            If the value of your collateral drops significantly relative to your borrowed debt, your position may be liquidated.
                                        </p>
                                        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                                            <li>Always monitor your <strong>Health Factor</strong>.</li>
                                            <li>Keep it above <strong>1.5</strong> for safety.</li>
                                            <li>Be extra careful with volatile assets.</li>
                                        </ul>
                                    </div>


                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-lg font-bold bg-[#CEFF00] hover:bg-[#b8e600] text-black transition-colors text-sm"
                    >
                        Got it
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

