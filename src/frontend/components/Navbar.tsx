'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from "@/components/ui/button";
import { Wallet, Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BRAND_LOGO_SRC = '/ArbiLoopBrand.png?v=20260222';

export function Navbar() {
    const pathname = usePathname();


    const navLinks = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Lend', href: '/lend' },
        { name: 'Portfolio', href: '/portfolio' },

    ];

    return (
        <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl shadow-lg shadow-black/5">
            <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-16">
                <Link href="/" className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="relative h-6 w-6 md:h-8 md:w-8">
                        <Image
                            src={BRAND_LOGO_SRC}
                            alt="ArbiLoop Logo"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                    <span className="font-outfit font-bold text-lg md:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400 drop-shadow-sm">ArbiLoop</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {/* Navigation Links */}
                    <div className="flex gap-6">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`text-sm font-medium transition-colors hover:text-primary ${(link.href === '/' ? pathname === '/' : pathname.startsWith(link.href))
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>



                    <Link href="/settings">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full bg-[#1A1A1E] hover:bg-[#2A2A2E] text-white border border-white/5"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </Link>

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
                                                    className="h-8 px-4 font-bold bg-[#3B82F6] text-white hover:bg-[#2563EB] rounded-full shadow-lg hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all flex items-center gap-2 text-sm"
                                                >
                                                    <Wallet className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                                                    Connect Wallet
                                                </Button>
                                            );
                                        }

                                        if (chain.unsupported) {
                                            return (
                                                <Button
                                                    onClick={openChainModal}
                                                    variant="destructive"
                                                    className="h-8 px-3 text-sm font-bold rounded-full shadow-lg transition-all"
                                                >
                                                    Wrong Network
                                                </Button>
                                            );
                                        }

                                        return (
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <Button
                                                    onClick={openChainModal}
                                                    variant="outline"
                                                    className="h-8 px-3 text-sm rounded-full border-white/10 hover:bg-white/5"
                                                    style={{ display: 'flex', alignItems: 'center' }}
                                                >
                                                    {chain.hasIcon && (
                                                        <div
                                                            style={{
                                                                background: chain.iconBackground,
                                                                width: 16,
                                                                height: 16,
                                                                borderRadius: 999,
                                                                overflow: 'hidden',
                                                                marginRight: 4,
                                                            }}
                                                        >
                                                            {chain.iconUrl && (
                                                                <img
                                                                    alt={chain.name ?? 'Chain icon'}
                                                                    src={chain.iconUrl}
                                                                    style={{ width: 16, height: 16 }}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                    {chain.name}
                                                </Button>

                                                <Button
                                                    onClick={openAccountModal}
                                                    className="h-8 px-3 text-sm rounded-full bg-secondary text-foreground hover:bg-secondary/80 font-mono"
                                                >
                                                    {account.displayName}
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>

                {/* Mobile Connect Button (Using Simplified State) */}
                <div className="md:hidden flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#28A0F0]/10 border border-[#28A0F0]/20 text-[#28A0F0]">
                        <div className="relative w-5 h-5">
                            <Image src="https://cryptologos.cc/logos/arbitrum-arb-logo.png" alt="Arbitrum" fill className="object-contain" unoptimized />
                        </div>
                    </div>
                    <ConnectButton.Custom>
                        {({
                            account,
                            chain,
                            openConnectModal,
                            openAccountModal,
                            authenticationStatus,
                            mounted,
                        }) => {
                            const ready = mounted && authenticationStatus !== 'loading';
                            const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

                            if (!connected) {
                                return (
                                    <Button
                                        size="sm"
                                        onClick={openConnectModal}
                                        className="h-8 px-4 font-bold bg-[#3B82F6] text-white hover:bg-[#2563EB] rounded-full text-xs"
                                    >
                                        Connect
                                    </Button>
                                )
                            }

                            // If connected, show Avatar or Name compacted
                            return (
                                <Button
                                    size="sm"
                                    onClick={openAccountModal}
                                    className="h-8 px-3 rounded-full bg-secondary text-foreground hover:bg-secondary/80 font-mono text-xs"
                                >
                                    {account.displayName}
                                </Button>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>
            </div>
        </nav>
    );
}


