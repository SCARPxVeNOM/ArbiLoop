'use client';

import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Wallet } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from "next/link";

export function Hero() {
    return (
        <section className="container max-w-screen-2xl mx-auto px-8 md:px-16 grid items-center gap-6 pb-8 pt-6 md:py-10 lg:py-32">
            <div className="flex max-w-[980px] flex-col items-start gap-4">
                <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
                    Maximize Your Arbitrum Yields <br className="hidden sm:inline" />
                    with <span className="text-primary">Automated Strategies</span>.
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
                    One-click looping and unwinding on Aave Protocol. Safely leverage your assets with real-time health monitoring and break-even analysis.
                </p>
            </div>

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
                            className="flex flex-col gap-4 sm:flex-row"
                            {...(!ready && {
                                'aria-hidden': true,
                                'style': {
                                    opacity: 0,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                },
                            })}
                        >
                            {!connected ? (
                                <Button size="lg" className="gap-2 font-bold text-lg px-8 h-14" onClick={openConnectModal}>
                                    Connect Wallet <Wallet className="h-5 w-5" />
                                </Button>
                            ) : (
                                <>
                                    <Link href="/dashboard">
                                        <Button size="lg" className="gap-2 font-bold text-lg px-8 h-14">
                                            Launch App <Zap className="h-5 w-5" />
                                        </Button>
                                    </Link>
                                    <Link href="/lend/strategy">
                                        <Button variant="outline" size="lg" className="gap-2 h-14">
                                            Manage Strategies <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    );
                }}
            </ConnectButton.Custom>
        </section>
    )
}
