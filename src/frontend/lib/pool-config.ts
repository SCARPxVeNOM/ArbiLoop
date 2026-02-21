import { parseAbi } from 'viem';
import allowedAssets from '@/lib/allowedAssets.json';
import { isArbitrumTarget } from '@/lib/network';

type ProtocolKey = 'aave' | 'kinza' | 'radiant';
type AllowedAsset = {
    symbol?: string;
    originalSymbol?: string;
    underlyingTokens?: string[];
};
type AllowedAssetsByProtocol = Partial<Record<ProtocolKey, AllowedAsset[]>>;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

const DEFAULT_AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as `0x${string}`;
const DEFAULT_AAVE_DATA_PROVIDER = '0x6b4E260b765B3cA1514e618C0215A6B7839fF93e' as `0x${string}`;
const DEFAULT_AAVE_GATEWAY = '0xB5Ee21786D28c5Ba61661550879475976B707099' as `0x${string}`;
const DEFAULT_RADIANT_POOL = '0xE23B4AE3624fB6f7cDEF29bC8EAD912f1Ede6886' as `0x${string}`;
const DEFAULT_RADIANT_GATEWAY = '0x8a8f65cabb82a857fa22289ad0a5785a5e7dbd22' as `0x${string}`;
const DEFAULT_DEX_ROUTER = '0xc873fEcbd354f5A56E00E710B90EF4201db2448d' as `0x${string}`;
const ARBITRUM_ONE_WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as `0x${string}`;

function toAddress(value: string | undefined, fallback: `0x${string}` = ZERO_ADDRESS): `0x${string}` {
    if (!value) return fallback;
    const normalized = value.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(normalized) ? (normalized as `0x${string}`) : fallback;
}

// Legacy export kept for compatibility; disabled in Arbitrum-only mode.
export const AAVE_COMPTROLLER = ZERO_ADDRESS;

export const KINZA_POOL = toAddress(process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS, DEFAULT_AAVE_POOL);
export const KINZA_DATA_PROVIDER = toAddress(process.env.NEXT_PUBLIC_AAVE_DATA_PROVIDER_ADDRESS, DEFAULT_AAVE_DATA_PROVIDER);
export const RADIANT_LENDING_POOL = toAddress(process.env.NEXT_PUBLIC_RADIANT_POOL_ADDRESS, DEFAULT_RADIANT_POOL);
export const DEX_ROUTER = toAddress(process.env.NEXT_PUBLIC_DEX_ROUTER_ADDRESS, DEFAULT_DEX_ROUTER);

export const LOOP_VAULT_ADDRESS = toAddress(process.env.NEXT_PUBLIC_LOOP_VAULT_ADDRESS);
export const WRAPPED_NATIVE = toAddress(
    process.env.NEXT_PUBLIC_WRAPPED_NATIVE_ADDRESS,
    isArbitrumTarget ? ARBITRUM_ONE_WETH : ZERO_ADDRESS,
);

// Legacy export kept for compatibility; disabled in Arbitrum-only mode.
export const AAVE_VTOKENS: Record<string, `0x${string}`> = {};

const ARBITRUM_UNDERLYING_TOKENS: Record<string, `0x${string}`> = {
    'ETH': WRAPPED_NATIVE,
    'WETH': WRAPPED_NATIVE,
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebe478A1C0b69FCbb9',
    'DAI': '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    'BTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
};

export const UNDERLYING_TOKENS: Record<string, `0x${string}`> = ARBITRUM_UNDERLYING_TOKENS;

export function getUnderlyingAddress(symbol: string, project: string): `0x${string}` | undefined {
    if (symbol === 'ETH' || symbol === 'WETH') return WRAPPED_NATIVE;

    const protocolKey: ProtocolKey | null = project === 'aave' ? 'aave' :
        (project === 'kinza-finance' || project === 'kinza' || project === 'aave-v3') ? 'kinza' :
            (project === 'radiant-v2' || project === 'radiant') ? 'radiant' : null;

    const typedAllowedAssets = allowedAssets as AllowedAssetsByProtocol;
    const protocolAssets = protocolKey ? typedAllowedAssets[protocolKey] : undefined;

    if (protocolAssets) {
        const asset = protocolAssets.find(
            (entry) => entry.symbol === symbol || entry.originalSymbol === symbol
        );
        const token = asset?.underlyingTokens?.[0];
        if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) {
            return token as `0x${string}`;
        }
    }

    return UNDERLYING_TOKENS[symbol] || undefined;
}

export function getProtocolAddress(project: string, symbol: string): `0x${string}` | undefined {
    if (project === 'aave') {
        return AAVE_VTOKENS[symbol];
    }
    if (project === 'kinza-finance' || project === 'kinza' || project === 'aave-v3') {
        return KINZA_POOL;
    }
    if (project === 'radiant-v2' || project === 'radiant') {
        return RADIANT_LENDING_POOL;
    }
    return undefined;
}

export function getApprovalTarget(project: string, symbol: string): `0x${string}` | undefined {
    if (project === 'aave') return AAVE_VTOKENS[symbol];
    if (project === 'kinza-finance' || project === 'kinza' || project === 'aave-v3') return KINZA_POOL;
    if (project === 'radiant-v2' || project === 'radiant') return RADIANT_LENDING_POOL;
    return undefined;
}

export const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
]);

export const COMPTROLLER_ABI = parseAbi([
    'function getAssetsIn(address account) view returns (address[])',
    'function getAccountLiquidity(address account) view returns (uint256, uint256, uint256)',
    'function enterMarkets(address[] calldata vTokens) returns (uint256[])',
    'function exitMarket(address vToken) returns (uint256)',
    'function markets(address) view returns (bool isListed, uint256 collateralFactorMantissa, bool isComped)',
    'function getAllMarkets() view returns (address[])',
]);

export const VTOKEN_ABI = parseAbi([
    'function mint(uint256 mintAmount) returns (uint256)',
    'function redeem(uint256 redeemTokens) returns (uint256)',
    'function redeemUnderlying(uint256 redeemAmount) returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function balanceOfUnderlying(address owner) returns (uint256)',
    'function exchangeRateStored() view returns (uint256)',
    'function borrowBalanceStored(address account) view returns (uint256)',
    'function borrow(uint256 borrowAmount) returns (uint256)',
    'function repayBorrow(uint256 repayAmount) returns (uint256)',
]);

export const VETH_ABI = parseAbi([
    'function mint() payable',
    'function repayBorrow() payable',
    'function redeem(uint256 redeemTokens) returns (uint256)',
    'function redeemUnderlying(uint256 redeemAmount) returns (uint256)',
    'function borrow(uint256 borrowAmount) returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function exchangeRateStored() view returns (uint256)',
    'function borrowBalanceStored(address account) view returns (uint256)',
]);

export const KINZA_POOL_ABI = parseAbi([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)',
]);

export const RADIANT_POOL_ABI = parseAbi([
    'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)',
]);

export const DEX_ROUTER_ABI = parseAbi([
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)'
]);

export const WETH_GATEWAY_ABI = parseAbi([
    'function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) payable',
    'function withdrawETH(address lendingPool, uint256 amount, address to)',
    'function borrowETH(address lendingPool, uint256 amount, uint256 interestRateMode, uint16 referralCode)',
    'function repayETH(address lendingPool, uint256 amount, uint256 rateMode, address onBehalfOf) payable',
]);

export const KINZA_GATEWAY = toAddress(process.env.NEXT_PUBLIC_AAVE_GATEWAY_ADDRESS, DEFAULT_AAVE_GATEWAY);
export const RADIANT_GATEWAY = toAddress(process.env.NEXT_PUBLIC_RADIANT_GATEWAY_ADDRESS, DEFAULT_RADIANT_GATEWAY);

export const LENDING_POOL_ABI = KINZA_POOL_ABI;

export const LOOP_VAULT_ABI = parseAbi([
    'function leverageKinza(address inputToken, address supplyAsset, address borrowAsset, uint256 amount, uint256 legacyExtraAmount, uint256 borrowAmount, address legacyRouteHint) payable',
    'function leverageRadiant(address inputToken, address supplyAsset, address borrowAsset, uint256 amount, uint256 legacyExtraAmount, uint256 borrowAmount, address legacyRouteHint) payable'
]);
