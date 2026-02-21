'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Zap, Wallet } from 'lucide-react';

export function LandingCTA() {
    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <ConnectButton.Custom>
                {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                }) => {
                    const ready = mounted && authenticationStatus !== 'loading';
                    const connected =
                        ready &&
                        account &&
                        chain &&
                        (!authenticationStatus ||
                            authenticationStatus === 'authenticated');

                    return (
                        <div
                            {...(!ready && {
                                'aria-hidden': true,
                                'style': {
                                    opacity: 0,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                },
                            })}
                        >
                            {(() => {
                                if (!connected) {
                                    return (
                                        <Button
                                            onClick={openConnectModal}
                                            className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-bold bg-[#CEFF00] text-black hover:bg-[#b8e600] rounded-full shadow-[0_0_20px_rgba(206,255,0,0.3)] transition-all hover:scale-105 w-full sm:w-auto flex items-center gap-2"
                                        >
                                            Connect Wallet <Wallet className="h-4 w-4 md:h-5 md:w-5" />
                                        </Button>
                                    );
                                }

                                if (chain.unsupported) {
                                    return (
                                        <Button
                                            onClick={openChainModal}
                                            variant="destructive"
                                            className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-bold rounded-full w-full sm:w-auto"
                                        >
                                            Wrong Network
                                        </Button>
                                    );
                                }

                                return (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Link href="/dashboard">
                                            <Button className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-bold bg-[#CEFF00] text-black hover:bg-[#b8e600] rounded-full shadow-[0_0_20px_rgba(206,255,0,0.3)] transition-all hover:scale-105 w-full sm:w-auto">
                                                Launch App
                                            </Button>
                                        </Link>
                                        <Link href="/strategy">
                                            <Button variant="outline" className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-bold border-white/10 hover:bg-white/5 rounded-full text-white w-full sm:w-auto">
                                                View Strategies
                                            </Button>
                                        </Link>
                                    </div>
                                );
                            })()}
                        </div>
                    );
                }}
            </ConnectButton.Custom>
        </div>
    );
}
