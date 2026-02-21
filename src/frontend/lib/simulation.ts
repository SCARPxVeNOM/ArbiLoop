
export interface Asset {
    symbol: string;
    protocol: string;
    apy: number;
    maxLTV: number; // This acts as Liquidation Threshold for simplicity in this demo
    price: number; // Needed for liquidation price calculation
}

export interface LoopResult {
    netApy: string;
    healthFactor: string;
    liquidationPrice: string;
    totalCollateral: number;
    totalDebt: number;
    leverage: number;
}

/**
 * Simulates a loop strategy.
 * 
 * @param amount Initial collateral amount (in Token units)
 * @param leverage Target leverage (e.g., 2.0x)
 * @param collateral Asset being supplied
 * @param debt Asset being borrowed
 */
export function simulateLoop(
    amount: number,
    leverage: number,
    collateral: Asset,
    debt: Asset
): LoopResult {
    // 1. Calculate Positions
    const totalCollateralAmount = amount * leverage;
    const totalCollateralValue = totalCollateralAmount * collateral.price;

    // Debt Value = Total Collateral Value - Initial Equity
    // Equity = amount * collateral.price
    const initialEquity = amount * collateral.price;
    const totalDebtValue = totalCollateralValue - initialEquity;

    // 2. Net APY
    // Supply Income = Total Collateral * Supply APY
    // Borrow Cost = Total Debt * Borrow APY
    const supplyIncome = totalCollateralValue * (collateral.apy / 100);
    const borrowCost = totalDebtValue * (Math.abs(debt.apy) / 100);
    const netIncome = supplyIncome - borrowCost;
    const netApy = (netIncome / initialEquity) * 100;

    // 3. Health Factor
    // HF = (Total Collateral Value * Max LTV) / Total Debt Value
    // If debt is 0 (1x leverage), HF is Infinity
    let healthFactor = Infinity;
    if (totalDebtValue > 0) {
        healthFactor = (totalCollateralValue * collateral.maxLTV) / totalDebtValue;
    }

    // 4. Liquidation Price
    // At what price of Collateral does HF drop to 1.0 (Liquidation)?
    // 1.0 = (Total Collateral Amount * Price_Liq * Max LTV) / Total Debt Value (assuming Debt value is constant e.g. stablecoin)
    // Price_Liq = Total Debt Value / (Total Collateral Amount * Max LTV)

    // Note: If Debt is not stable (e.g. ETH/BTC loop), this formula is more complex (Price_Liq of ratio). 
    // For simplicity, we assume Debt is stable (USDT) or we are calculating price drop of Collateral relative to Debt.

    let liquidationPrice = 0;
    if (totalCollateralAmount > 0 && collateral.maxLTV > 0) {
        liquidationPrice = totalDebtValue / (totalCollateralAmount * collateral.maxLTV);
    }

    // If borrowing same asset as collateral (e.g. ETH/ETH), Liq Price is irrelevant in USD terms (delta neutral-ish), 
    // but implies specific risk if rates diverge.
    // Ideally we return accurate Liq Price relative to Debt.

    return {
        netApy: netApy.toFixed(2),
        healthFactor: healthFactor > 100 ? '∞' : healthFactor.toFixed(2),
        liquidationPrice: liquidationPrice.toFixed(2),
        totalCollateral: totalCollateralAmount,
        totalDebt: totalDebtValue, // In USD term if debt is stable
        leverage
    };
}
