import { arbitrum, arbitrumSepolia } from 'wagmi/chains';

export type TargetChainKey = 'arbitrum' | 'arbitrum-sepolia';

const TARGET_CHAIN_ALIASES: Record<string, TargetChainKey> = {
    '42161': 'arbitrum',
    'arbitrum': 'arbitrum',
    'arbitrum-one': 'arbitrum',
    '421614': 'arbitrum-sepolia',
    'arbitrum-sepolia': 'arbitrum-sepolia',
    'arbitrumsepolia': 'arbitrum-sepolia',
};

const envChain = (process.env.NEXT_PUBLIC_TARGET_CHAIN || 'arbitrum').toLowerCase();

export const targetChainKey: TargetChainKey = TARGET_CHAIN_ALIASES[envChain] || 'arbitrum';
export const isArbitrumTarget = targetChainKey === 'arbitrum';
export const isArbitrumSepoliaTarget = targetChainKey === 'arbitrum-sepolia';
export const isArbitrumFamily = isArbitrumTarget || isArbitrumSepoliaTarget;

export const targetChain =
    targetChainKey === 'arbitrum'
        ? arbitrum
        : arbitrumSepolia;

export const targetChainId = targetChain.id;
export const targetChainName = targetChain.name;
export const targetDefiLlamaChain = 'Arbitrum';
export const targetNativeSymbol = 'ETH';
export const targetWrappedNativeSymbol = 'WETH';
