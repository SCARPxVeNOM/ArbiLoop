'use client';

import * as React from 'react';
import {
    RainbowKitProvider,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { ThemeProvider } from 'next-themes';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
                    <RainbowKitThemedProvider>
                        {children}
                    </RainbowKitThemedProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

function RainbowKitThemedProvider({ children }: { children: React.ReactNode }) {
    return (
        <RainbowKitProvider
            theme={darkTheme({
                accentColor: '#CEFF00', // Neon Lime
                accentColorForeground: 'black',
                borderRadius: 'medium',
                fontStack: 'system',
            })}
        >
            {children}
        </RainbowKitProvider>
    );
}
