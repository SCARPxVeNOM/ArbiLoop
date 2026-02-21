import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatMoney = (num: number) => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
};

/**
 * Format token amounts with subscript notation for tiny values.
 * e.g. 0.0000032 -> "0.0(5)32" where (5) is rendered as subscript.
 */
export const formatTokenAmount = (num: number): string => {
    if (num === 0) return "0";
    if (num >= 1) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (num >= 0.01) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (num >= 0.0001) return num.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return "<0.0001";
};

/**
 * Format tiny token amounts with subscript zero-count notation.
 */
export function formatSmallNumber(num: number): React.ReactNode {
    if (num === 0) return "0";
    if (num >= 0.0001) return formatTokenAmount(num);

    const str = num.toFixed(20);
    const match = str.match(/^0\.(0+)(\d{2,4})/);
    if (!match) return formatTokenAmount(num);

    const zeroCount = match[1].length;
    const significantDigits = match[2];

    return React.createElement(
        "span",
        null,
        "0.0",
        React.createElement("sub", null, zeroCount.toString()),
        significantDigits
    );
}

export const TOKEN_DECIMALS: Record<string, number> = {
    ETH: 18,
    WETH: 18,
    WBTC: 8,
    USDT: 6,
    USDC: 6,
    DAI: 18,
    FDUSD: 18,
    LINK: 18,
    DOT: 10,
    LTC: 8,
    FIL: 18,
    SOL: 9,
    WBETH: 18,
    BCH: 8,
    ADA: 6,
    XRP: 6,
};

export function getTokenDecimals(symbol: string): number {
    return TOKEN_DECIMALS[symbol] || 18;
}

/**
 * Converts a number to a plain string, avoiding scientific notation.
 */
export function toPlainString(num: number): string {
    return num.toFixed(18).replace(/\.?0+$/, "");
}

