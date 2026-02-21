import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { targetChainKey } from '@/lib/network';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const chains: readonly [typeof arbitrum] | readonly [typeof arbitrumSepolia] =
    targetChainKey === 'arbitrum'
        ? [arbitrum]
        : [arbitrumSepolia];

export const config = getDefaultConfig({
    appName: 'ArbiLoop',
    projectId: walletConnectProjectId,
    chains,
    ssr: true, // If your dApp uses server side rendering (SSR)
});

