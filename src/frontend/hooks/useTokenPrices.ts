import { useQuery } from '@tanstack/react-query';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

const SYMBOL_TO_ID: Record<string, string> = {
    'BTC': 'bitcoin',
    'WBTC': 'wrapped-bitcoin',
    'ETH': 'ethereum',
    'WETH': 'weth',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'FDUSD': 'first-digital-usd',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'RDNT': 'radiant-capital',
    'MATIC': 'matic-network',
    'FIL': 'filecoin',
    'BCH': 'bitcoin-cash',
    'LTC': 'litecoin',
    'DOT': 'polkadot',
    'DOGE': 'dogecoin',
    'ADA': 'cardano',
    'XRP': 'ripple',
    'SOL': 'solana',
};

const STABLE_PRICES: Record<string, number> = {
    'USDT': 1,
    'USDC': 1,
    'FDUSD': 1,
    'DAI': 1,
};

async function fetchPrices() {
    try {
        const ids = Array.from(new Set(Object.values(SYMBOL_TO_ID))).join(',');
        const response = await fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=usd`);
        const data = await response.json();
        return data as Record<string, { usd: number }>;
    } catch (error) {
        console.error('Failed to fetch prices', error);
        return {} as Record<string, { usd: number }>;
    }
}

export function useTokenPrices() {
    return useQuery({
        queryKey: ['token-prices'],
        queryFn: fetchPrices,
        refetchInterval: 30000,
        staleTime: 60000,
        select: (data) => {
            const getPrice = (symbol: string) => {
                const upper = symbol.toUpperCase();
                if (STABLE_PRICES[upper]) return STABLE_PRICES[upper];

                const id = SYMBOL_TO_ID[upper];
                if (id && data[id]?.usd) return data[id].usd;

                return 0;
            };

            return { getPrice, raw: data };
        }
    });
}
