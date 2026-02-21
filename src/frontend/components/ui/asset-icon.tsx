"use client";

const ASSET_LOGOS: Record<string, string> = {
    'USDT': 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
    'USDC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    'FDUSD': 'https://s2.coinmarketcap.com/static/img/coins/64x64/26081.png',
    'ETH': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
    'WETH': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
    'BTC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    'WBTC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/4023.png',
    'SOLVBTC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/4023.png',
    'ASETH': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
    'SLISETH': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            'XRP': 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png',
    'ADA': 'https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png',
    'DOGE': 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png',
    'DOT': 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png',
    'TRX': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
    'LTC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/2.png',
    'BCH': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1831.png',
    'FIL': 'https://s2.coinmarketcap.com/static/img/coins/64x64/2280.png',
    'ATOM': 'https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png',
    'NEAR': 'https://s2.coinmarketcap.com/static/img/coins/64x64/6535.png',
    'UNI': 'https://s2.coinmarketcap.com/static/img/coins/64x64/7083.png',
    'LINK': 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png',
    'MATIC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
    'SHIB': 'https://s2.coinmarketcap.com/static/img/coins/64x64/5994.png',
    'DAI': 'https://s2.coinmarketcap.com/static/img/coins/64x64/4943.png',
    'TUSD': 'https://s2.coinmarketcap.com/static/img/coins/64x64/2563.png',
    'CAKE': 'https://s2.coinmarketcap.com/static/img/coins/64x64/7186.png',
    'AAVE': 'https://s2.coinmarketcap.com/static/img/coins/64x64/7278.png',
    'RDNT': 'https://s2.coinmarketcap.com/static/img/coins/64x64/21159.png',
    'SXP': 'https://s2.coinmarketcap.com/static/img/coins/64x64/6842.png',
    'TWT': 'https://s2.coinmarketcap.com/static/img/coins/64x64/5964.png',
    'XSOLVBTC': 'https://s2.coinmarketcap.com/static/img/coins/64x64/4023.png',
};

const ARBITRUM_BADGE = 'https://cryptologos.cc/logos/arbitrum-arb-logo.png';

interface AssetIconProps {
    symbol: string;
    tokenAddress?: string;
    size?: number;
    className?: string;
}

export function AssetIcon({ symbol, tokenAddress, size = 32, className = '' }: AssetIconProps) {
    const s = symbol.toUpperCase();

    // 1. Hardcoded Mapping (Fastest & Most Reliable for Majors)
    let logoUrl = ASSET_LOGOS[s];

    // 2. TrustWallet Assets (If Address is known)
    if (!logoUrl && tokenAddress) {
        // TrustWallet uses checksum address usually, but let's try direct. 
        // Note: TrustWallet repo is case-sensitive (Checksummed).
        // Since we don't have checksum util here comfortably, we might need to rely on what the API return.
        // API usually returns Checksummed.
        logoUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/${tokenAddress}/logo.png`;
    }

    // 3. CoinCap Fallback (Generic Symbol)
    if (!logoUrl) {
        logoUrl = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
    }

    // Special case for WBTC if not found
    if (!logoUrl && s === 'WBTC') {
        logoUrl = ASSET_LOGOS['BTC'];
    }

    const fallbackImage = ASSET_LOGOS['ETH']; // Ultimate fallback

    return (
        <div className={`relative flex items-center justify-center bg-transparent ${className}`} style={{ width: size, height: size }}>
            {/* Main Token Logo */}
            <div className="rounded-full overflow-hidden bg-white/5 border border-white/10" style={{ width: size, height: size }}>
                <img
                    src={logoUrl}
                    alt={symbol}
                    width={size}
                    height={size}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                        // Fallback logic on error
                        const target = e.target as HTMLImageElement;
                        // Determine failure chain
                        if (target.src === logoUrl && logoUrl !== fallbackImage) {
                            // If TrustWallet failed, try CoinCap? 
                            // Simplify: just go to fallback or generic first letter?
                            target.src = fallbackImage;
                        }
                    }}
                />
            </div>

            {/* Chain badge (Bottom Right) */}
            <div className="absolute -bottom-1 -right-1 rounded-full border border-black bg-[#121216] p-[1px]" style={{ width: size * 0.45, height: size * 0.45 }}>
                <img src={ARBITRUM_BADGE} alt="Arbitrum" className="w-full h-full object-contain" />
            </div>
        </div>
    );
}
