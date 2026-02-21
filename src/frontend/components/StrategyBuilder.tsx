'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { AssetIcon } from "@/components/ui/asset-icon";
import { useYields } from "@/hooks/useYields";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { ArrowRight, RefreshCw, AlertTriangle, TrendingUp, Layers, Check, ChevronDown, Banknote } from 'lucide-react';
import { RiskMonitor } from './RiskMonitor';
import { useToast } from "@/components/ui/use-toast";

// Custom Dropdown Component for Theme Consistency
function AssetSelect({ value, options, onChange }: { value: string, options: string[], onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="w-full h-12 pl-3 pr-3 rounded-lg border border-input bg-card flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <div className="flex items-center gap-2">
                    <AssetIcon symbol={value} size={24} />
                    <span className="font-bold">{value}</span>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        {options.map((opt) => (
                            <div
                                key={opt}
                                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors ${value === opt ? 'bg-accent/50' : ''}`}
                                onClick={() => { onChange(opt); setOpen(false); }}
                            >
                                <AssetIcon symbol={opt} size={20} />
                                <span className={`flex-1 ${value === opt ? 'font-bold' : ''}`}>{opt}</span>
                                {value === opt && <Check size={14} className="text-primary" />}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export function StrategyBuilder() {
    const { address } = useAccount();
    const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
    const { data: yields } = useYields();
    const { data: priceData } = useTokenPrices();
    const getPrice = priceData?.getPrice || ((_s: string) => 0);
    const { toast } = useToast();
    const { openConnectModal } = useConnectModal();
    const searchParams = useSearchParams();

    // -- State --
    const [selectedProtocol, setSelectedProtocol] = useState<'aave' | 'kinza' | 'radiant'>('aave');
    const [refinanceToProtocol, setRefinanceToProtocol] = useState<'aave' | 'kinza' | 'radiant'>('kinza');

    const [supplyAsset, setSupplyAsset] = useState('ETH');
    const [borrowAsset, setBorrowAsset] = useState('USDT'); // Asset to borrow (and swap back to Supply Asset)
    const [amount, setAmount] = useState<string>('');
    const [leverage, setLeverage] = useState(1.5);
    const [mode, setMode] = useState<'loop' | 'unwind' | 'refinance'>('loop');

    // -- Read URL params for preselection --
    useEffect(() => {
        const supplyParam = searchParams.get('supply');
        const borrowParam = searchParams.get('borrow');
        const protocolParam = searchParams.get('protocol');

        if (supplyParam) setSupplyAsset(supplyParam.toUpperCase());
        if (borrowParam) setBorrowAsset(borrowParam.toUpperCase());
        if (protocolParam) {
            const p = protocolParam.toLowerCase();
            if (p === 'aave' || p === 'kinza' || p === 'radiant') {
                setSelectedProtocol(p);
            }
        }
    }, [searchParams]);

    // -- Effects for Toast --
    useEffect(() => {
        if (isConfirmed) {
            toast({
                title: "Transaction Confirmed!",
                description: "Your strategy has been successfully executed on-chain.",
                variant: "default", // success
            });
        }
    }, [isConfirmed, toast]);

    // Derived Data
    const protocolAssets = useMemo(() => {
        if (!yields) return [];
        return yields.filter(p => p.project === selectedProtocol);
    }, [yields, selectedProtocol]);

    const targetProtocolAssets = useMemo(() => { // For Refinance
        if (!yields) return [];
        return yields.filter(p => p.project === refinanceToProtocol);
    }, [yields, refinanceToProtocol]);

    const supplyPool = protocolAssets.find(p => p.symbol === supplyAsset);
    const borrowPool = protocolAssets.find(p => p.symbol === borrowAsset);
    const targetSupplyPool = targetProtocolAssets.find(p => p.symbol === supplyAsset); // Refinance Target

    // Calculation Logic (USD Based)
    const principalAmount = parseFloat(amount) || 0;
    const priceSupply = getPrice(supplyAsset) || 0;
    const priceBorrow = getPrice(borrowAsset) || 0;

    // 1. Calculate Principal Value in USD
    const principalValueUSD = principalAmount * priceSupply;

    // 2. Calculate Total Exposure Value in USD based on Leverage
    // Leverage 3x means Total Exposure = 3 * Principal
    const totalExposureValueUSD = principalValueUSD * leverage;

    // 3. Calculate Flash Loan (Borrow) Value in USD
    // Borrow = Total Exposure - Principal
    const flashLoanValueUSD = totalExposureValueUSD - principalValueUSD;

    // 4. Convert Values back to Token Amounts
    // How much Collateral (Supply Asset) will we have total?
    // Total Collateral Tokens = Total Exposure USD / Supply Price
    const totalCollateralTokens = priceSupply > 0 ? totalExposureValueUSD / priceSupply : 0;

    // How much Debt (Borrow Asset) will we check out?
    // Total Debt Tokens = Flash Loan USD / Borrow Price
    const totalDebtTokens = priceBorrow > 0 ? flashLoanValueUSD / priceBorrow : 0;

    // APY Rates
    const supplyAPY = supplyPool?.apy || 0;
    const borrowAPY = borrowPool?.apyBaseBorrow || 0;

    // Refinance Calculations
    const currentRate = borrowPool?.apyBaseBorrow || 0;
    const newRate = targetSupplyPool?.apyBaseBorrow || 0;
    const rateDiff = currentRate - newRate;
    const savingsPerYear = flashLoanValueUSD * (rateDiff / 100); // Savings on the debt value

    // Net APY Logic
    // (Supply APY * Total Exposure USD) - (Borrow APY * Total Debt USD) / Principal USD
    const netAPY = principalValueUSD > 0
        ? ((supplyAPY * totalExposureValueUSD) - (borrowAPY * flashLoanValueUSD)) / principalValueUSD
        : 0;

    // Safety Score (Health Factor)
    // HF = (Total Collateral Value USD * Liquidation Threshold) / Total Debt Value USD
    const liquidationThreshold = supplyPool?.ltv || 0.8;
    const healthFactor = flashLoanValueUSD > 0
        ? (totalExposureValueUSD * liquidationThreshold) / flashLoanValueUSD
        : 999;

    const safetyScoreLabel = healthFactor >= 999 ? 'Perfect' : healthFactor > 2 ? 'Excellent' : healthFactor > 1.5 ? 'Good' : healthFactor > 1.1 ? 'Risky' : 'Danger';
    const hfColor = healthFactor >= 999 ? 'text-blue-400' : healthFactor < 1.1 ? 'text-red-500' : healthFactor < 1.5 ? 'text-yellow-500' : 'text-emerald-500';

    // -- Actions --
    const handleExecute = () => {
        if (!address) return;

        // Mock Addresses
        const assetAddr = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
        const vTokenAddr = '0xA07c5b74C9B40447a954e1466938b865b6BBe19B';
        const borrowAssetAddr = '0x55d398326f99059fF775485246999027B3197955';
        const vBorrowTokenAddr = '0xfD5840Cd36d94D7229439859C0112a4185BC0255';
        const routerAddr = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
        const comptrollerAddr = '0xfD36E2c2a6789Db23113685031d7F16329158384';

        // Parse Principal Amount to Wei
        const amountWei = BigInt(Math.floor(principalAmount * 1e18));

        if (mode === 'loop') {
            // Using totalDebtTokens as the borrow amount
            const borrowAmountWei = BigInt(Math.floor(totalDebtTokens * 1e18));

            // Assume User has a wallet via Factory. We call the WALLET address, not the Factory.
            // But for this frontend, we might need to know the User's Wallet Address.
            // For MVP: We will simulate the call via the Factory or assume a fixed wallet if we had `getWallet` hook.
            // Since we don't have the user's DS wallet address in a hook yet, let's assume we call the Factory to "execute via wallet" 
            // OR we just alert "Smart Wallet not found" if real. 
            // For hackathon demo: We will trigger the `ExecutionFactory` create if needed, or directly call `ExecutionWallet` if we knew the address.

            // DEMO FIX: We will just log the intended call payload.
            // AND we will try to write to a "Demo Wallet" if we had one.
            // Let's assume the user IS the owner of `ExecutionWallet` at address X.
            // Updated implementation attempts to find wallet or create it.

            console.log("Executing Loop via Smart Wallet...");
            alert(`Simulating transaction: Loop ${amount} ${supplyAsset} with ${leverage}x leverage on ${selectedProtocol}`);
        } else if (mode === 'refinance') {
            alert(`Simulating Refinance: Moving position from ${selectedProtocol} to ${refinanceToProtocol}. Estimated savings: $${savingsPerYear.toFixed(2)}/yr`);
        } else {
            alert("Simulating Unwind: Emergency exit triggered.");
        }
    };

    return (
        <Card id="strategy-builder" className="w-full max-w-2xl mx-auto shadow-2xl relative overflow-hidden h-full border-border bg-card transition-all duration-500 scroll-mt-32">
            {/* Header / Protocol Selector */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${mode === 'loop' ? 'from-transparent via-primary to-transparent' : mode === 'refinance' ? 'from-transparent via-blue-500 to-transparent' : 'from-transparent via-red-500 to-transparent'} opacity-50 transition-colors duration-500`}></div>

            {/* Simulation Badge */}
            <div className="absolute top-2 right-2 z-10">
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={10} /> SIMULATION MODE
                </div>
            </div>

            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                    {/* Strategy Mode Toggles */}
                    <div className="flex bg-muted p-1 rounded-full w-fit mx-auto overflow-x-auto max-w-full">
                        <button
                            onClick={() => setMode('loop')}
                            className={`px-4 md:px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'loop'
                                ? 'bg-background text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <TrendingUp size={14} /> Boost (Loop)
                        </button>
                        <button
                            onClick={() => setMode('refinance')}
                            className={`px-4 md:px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'refinance'
                                ? 'bg-background text-blue-500 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <RefreshCw size={14} /> Pay Off (Move)
                        </button>
                        <button
                            onClick={() => setMode('unwind')}
                            className={`px-4 md:px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'unwind'
                                ? 'bg-background text-red-500 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <AlertTriangle size={14} /> Panic Exit
                        </button>
                    </div>

                    <div className="flex md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Layers className={`w-5 h-5 ${mode === 'loop' ? 'text-primary' : mode === 'refinance' ? 'text-blue-500' : 'text-red-500'}`} />
                                {mode === 'loop' ? 'Yield Booster' : mode === 'refinance' ? 'Debt Pay Off' : 'Emergency Exit'}
                            </CardTitle>
                            <CardDescription>
                                {mode === 'loop' ? 'Amplify your APY efficiently.' : mode === 'refinance' ? 'Move loans to cheaper protocols.' : 'Unwind positions instantly.'}
                            </CardDescription>
                        </div>

                        {/* Protocol Selector Tabs */}
                        <div className="flex bg-muted p-1 rounded-lg">
                            {(['aave', 'kinza', 'radiant'] as const).map((proto) => (
                                <button
                                    key={proto}
                                    onClick={() => setSelectedProtocol(proto)}
                                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${selectedProtocol === proto
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {proto}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-8">
                {mode === 'refinance' ? (
                    /* REFINANCE MODE UI */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            {/* FROM */}
                            <div className="p-4 border border-border rounded-xl bg-muted/20">
                                <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Move From</div>
                                <div className="text-xl font-bold capitalize flex items-center gap-2">
                                    <img src={`/assets/icons/${selectedProtocol}.png`} alt="" className="w-6 h-6 rounded-full bg-gray-200" onError={(e) => e.currentTarget.style.display = 'none'} />
                                    {selectedProtocol}
                                </div>
                                <div className="mt-2 text-sm text-red-400">Current Rate: {currentRate.toFixed(2)}%</div>
                            </div>

                            {/* TO */}
                            <div className="p-4 border border-blue-500/30 rounded-xl bg-blue-500/5 relative">
                                <div className="absolute top-1/2 -left-3 transform -translate-y-1/2 bg-background border border-border rounded-full p-1 z-10 md:block hidden">
                                    <ArrowRight size={16} />
                                </div>
                                <div className="text-xs font-bold uppercase text-blue-500 mb-2">Move To</div>
                                <div className="flex gap-2 mb-2">
                                    {(['aave', 'kinza', 'radiant'] as const).filter(p => p !== selectedProtocol).map((proto) => (
                                        <button
                                            key={proto}
                                            onClick={() => setRefinanceToProtocol(proto)}
                                            className={`px-3 py-1 text-xs font-bold uppercase rounded-md border transition-all ${refinanceToProtocol === proto
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-background border-border hover:border-blue-500'
                                                }`}
                                        >
                                            {proto}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-sm text-emerald-500">New Rate: {newRate.toFixed(2)}%</div>
                            </div>
                        </div>

                        {/* Input Amount */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Loan Amount to Move
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full h-12 px-4 rounded-lg border border-input bg-background/50 focus:ring-1 focus:ring-blue-500/50 outline-none font-mono text-right no-spin-button"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Amt</span>
                            </div>
                        </div>

                        {/* Calculator */}
                        {amount && (
                            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                                <div className="flex items-center gap-3 mb-2">
                                    <Banknote className="text-emerald-500" size={20} />
                                    <span className="font-bold text-emerald-500">Is It Worth It?</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Est. Annual Savings</span>
                                    <span className="text-xl font-bold text-emerald-500">+${savingsPerYear.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-2 opacity-80">
                                    <span>Gas Cost: ~$0.50</span>
                                    <span>Break-even: {(0.50 / (savingsPerYear / 365)).toFixed(1)} days</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : mode === 'loop' ? (
                    /* LOOP MODE UI (Existing) */
                    <>
                        {/* Supply/Borrow Inputs - Same as before but with "Safety Score" labels */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Supply Config */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    You Supply (Collateral)
                                </label>

                                <div className="flex gap-2">
                                    <div className="relative w-1/3 min-w-[140px] z-20">
                                        <AssetSelect
                                            value={supplyAsset}
                                            options={Array.from(new Set(protocolAssets.map(p => p.symbol)))}
                                            onChange={setSupplyAsset}
                                        />
                                    </div>

                                    <div className="relative flex-1 z-10">
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full h-12 px-4 rounded-lg border border-input bg-background/50 focus:ring-1 focus:ring-primary/50 outline-none font-mono text-right no-spin-button"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Amt</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs px-1 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground">Supply APY:</span>
                                        <span className="text-emerald-500 font-mono font-bold">{supplyAPY.toFixed(2)}%</span>
                                    </div>
                                    <div className="text-muted-foreground text-[10px] text-right">
                                        ≈ ${(parseFloat(amount) * (getPrice(supplyAsset) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Borrow Config */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    You Borrow (Asset)
                                </label>
                                <div className="relative z-20">
                                    <AssetSelect
                                        value={borrowAsset}
                                        options={Array.from(new Set(protocolAssets.map(p => p.symbol)))}
                                        onChange={setBorrowAsset}
                                    />
                                </div>
                                <div className="flex justify-between text-xs px-1 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground">Borrow Cost:</span>
                                        <span className="text-red-500 font-mono font-bold">{borrowAPY.toFixed(2)}%</span>
                                    </div>
                                    <div className="text-muted-foreground text-[10px] text-right">
                                        ≈ ${flashLoanValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leverage Slider */}
                        <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium">Boost Multiplier</label>
                                <span className="text-xl font-bold text-primary font-mono">{leverage.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1.0"
                                max={(1 / (1 - (supplyPool?.ltv || 0.6))).toFixed(2)}
                                step="0.05"
                                className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                                value={leverage}
                                onChange={(e) => setLeverage(Math.min(parseFloat(e.target.value), 1 / (1 - (supplyPool?.ltv || 0.6))))}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                <span>Conservative</span>
                                <span className="text-red-500/80">Aggressive</span>
                            </div>
                        </div>

                        {/* Stats Grid - "Is It Worth It?" */}
                        {amount && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 flex flex-col items-center justify-center">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Projected Return (Net APY)</div>
                                    <div className="text-2xl font-bold text-primary drop-shadow-md">
                                        {netAPY.toFixed(2)}%
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Base APY: {supplyAPY.toFixed(2)}%
                                    </div>
                                </div>

                                <RiskMonitor
                                    healthFactor={healthFactor}
                                    liquidationThreshold={liquidationThreshold}
                                    liquidationPrice={(() => {
                                        const priceSupply = getPrice(supplyAsset) || 0;
                                        const priceBorrow = getPrice(borrowAsset) || 0;
                                        if (priceSupply === 0 || priceBorrow === 0) return 0;

                                        // Determine if "Long" (Supply Volatile) or "Short" (Borrow Volatile)
                                        // Simple Heuristic: If Supply is Stable (USDT/USDC/DAI/FDUSD) and Borrow is NOT, we are Shorting Borrow Asset.
                                        // If Both Stable or Both Volatile, default to monitoring Supply Drop.
                                        const isSupplyStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(supplyAsset);
                                        const isBorrowStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(borrowAsset);

                                        if (isSupplyStable && !isBorrowStable) {
                                            // Short Scenario: Risk is Borrow Price Rising.
                                            // Liq Condition: CollateralValue * LTV = DebtValue
                                            // DebtValue = BorrowAmount * LiqPrice_Borrow
                                            // LiqPrice_Borrow = (CollateralValue * LTV) / BorrowAmount

                                            // Collateral Value is fixed (since Supply is Stable).
                                            return totalDebtTokens > 0 ? (totalExposureValueUSD * liquidationThreshold) / totalDebtTokens : 0;
                                        } else {
                                            // Long Scenario (Standard): Risk is Supply Price Dropping.
                                            // Liq Condition: CollateralAmount * LiqPrice_Supply * LTV = DebtValue
                                            // LiqPrice_Supply = DebtValue / (CollateralAmount * LTV)
                                            // Debt Value is fixed (since Borrow is Stable/Pegged relative to risk).
                                            return totalCollateralTokens > 0 ? flashLoanValueUSD / (totalCollateralTokens * liquidationThreshold) : 0;
                                        }
                                    })()}
                                    currentPrice={(() => {
                                        const isSupplyStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(supplyAsset);
                                        const isBorrowStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(borrowAsset);
                                        if (isSupplyStable && !isBorrowStable) return getPrice(borrowAsset) || 0;
                                        return getPrice(supplyAsset) || 0;
                                    })()}
                                    pairName={(() => {
                                        const isSupplyStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(supplyAsset);
                                        const isBorrowStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(borrowAsset);
                                        if (isSupplyStable && !isBorrowStable) return `${borrowAsset}/USD (Max)`;
                                        return `${supplyAsset}/USD (Min)`;
                                    })()}
                                    dropLabel={(() => {
                                        const isSupplyStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(supplyAsset);
                                        const isBorrowStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(borrowAsset);
                                        if (isSupplyStable && !isBorrowStable) return 'Max Price Rise';
                                        return 'Max Price Drop';
                                    })()}
                                    projectedDrop={(() => {
                                        const priceSupply = getPrice(supplyAsset) || 0;
                                        const priceBorrow = getPrice(borrowAsset) || 0;
                                        if (priceSupply === 0 || priceBorrow === 0) return 0;

                                        const isSupplyStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(supplyAsset);
                                        const isBorrowStable = ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(borrowAsset);

                                        if (isSupplyStable && !isBorrowStable) {
                                            // Short Scenario: Calculate % Rise to Liquidation
                                            const currentP = priceBorrow;
                                            const liqPrice = totalDebtTokens > 0 ? (totalExposureValueUSD * liquidationThreshold) / totalDebtTokens : 0;
                                            return ((liqPrice - currentP) / currentP) * 100;
                                        } else {
                                            // Long Scenario: Calculate % Drop to Liquidation
                                            const currentP = priceSupply;
                                            const liqPrice = totalCollateralTokens > 0 ? flashLoanValueUSD / (totalCollateralTokens * liquidationThreshold) : 0;
                                            return ((liqPrice - currentP) / currentP) * 100;
                                        }
                                    })()}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    /* UNWIND MODE UI */
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10 text-sm text-red-500/80 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span><strong>Emergency Exit:</strong> Flash-repay debt and withdraw collateral instantly.</span>
                        </div>
                        {/* Selector: Debt to Repay */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Asset to Expose
                            </label>
                            <div className="relative">
                                <AssetSelect
                                    value={borrowAsset}
                                    options={Array.from(new Set(protocolAssets.map(p => p.symbol)))}
                                    onChange={setBorrowAsset}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-4 pb-6">
                {!address ? (
                    <Button
                        className="w-full h-12 text-lg font-bold"
                        onClick={openConnectModal}
                    >
                        Connect Wallet to Simulate
                    </Button>
                ) : (
                    <Button
                        className={`w-full h-12 text-lg font-bold shadow-lg transition-all transform hover:scale-[1.02] ${mode === 'loop'
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : mode === 'refinance'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-red-500 text-white hover:bg-red-600'
                            }`}
                        onClick={handleExecute}
                        disabled={!amount || isWritePending || isConfirming || parseFloat(amount) <= 0}
                    >
                        {(isWritePending || isConfirming) ? 'Processing on Blockchain...' : (
                            <span className="flex items-center gap-2">
                                {mode === 'loop' ? (
                                    <>Simulate Yield Boost <TrendingUp size={20} /></>
                                ) : mode === 'refinance' ? (
                                    <>Simulate Move <ArrowRight size={20} /></>
                                ) : (
                                    <>Simulate Exit <AlertTriangle size={20} /></>
                                )}
                            </span>
                        )}
                    </Button>
                )}
            </CardFooter>
        </Card >
    );
}

