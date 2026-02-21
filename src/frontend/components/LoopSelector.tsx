'use client';

import { useState, useMemo, useEffect } from 'react';
import { AssetIcon } from "@/components/ui/asset-icon";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { simulateLoop } from '@/lib/simulation';
import { useYields } from "@/hooks/useYields";
import { useTokenPrices } from "@/hooks/useTokenPrices";

// --- DATA DEFINITIONS ---

type Protocol = 'Aave' | 'Kinza' | 'Radiant';

// Internal Asset interface for Simulation
interface Asset {
    symbol: string;
    protocol: string;
    apy: number;
    maxLTV: number;
    price: number;
}

export function LoopSelector() {
    const [activeProtocol, setActiveProtocol] = useState<Protocol>('Aave');
    const [leverage, setLeverage] = useState([1.5]); // 1x to 5x

    // Fetch Data
    const { data: yields, isLoading: isLoadingYields } = useYields();
    const { data: priceData } = useTokenPrices();

    // Derived Lists based on Protocol
    const protocolAssets = useMemo(() => {
        if (!yields) return [];
        return yields.filter(y => y.project.toLowerCase() === activeProtocol.toLowerCase());
    }, [yields, activeProtocol]);

    // State for selections (Symbols only)
    const [selectedCollateralSymbol, setSelectedCollateralSymbol] = useState<string>('');
    const [selectedDebtSymbol, setSelectedDebtSymbol] = useState<string>('');

    // Set defaults when assets load or protocol changes
    useEffect(() => {
        if (protocolAssets.length > 0) {
            // Default Collateral: Check for ETH, ETH, BTC, or fall back to first
            // Prefer non-stable for collateral to show "yield" usually, but user choice.
            // Let's pick a Major if available, else first.
            const preferredCol = protocolAssets.find(a => ['ETH', 'ETH', 'BTC', 'WBTC', 'WBTC'].includes(a.symbol)) || protocolAssets[0];
            queueMicrotask(() => setSelectedCollateralSymbol(prev => {
                // If previous selection exists in new list, keep it?
                // Actually, distinct lists per protocol usually so reset is safer or check existence
                const exists = protocolAssets.find(a => a.symbol === prev);
                return exists ? prev : preferredCol.symbol;
            }));

            // Default Debt: Prefer Stable (USDT)
            const preferredDebt = protocolAssets.find(a => ['USDT', 'USDC'].includes(a.symbol)) || protocolAssets[0];
            queueMicrotask(() => setSelectedDebtSymbol(prev => {
                const exists = protocolAssets.find(a => a.symbol === prev);
                return exists ? prev : preferredDebt.symbol;
            }));
        }
    }, [protocolAssets]);

    // Helpers to get full Asset objects
    const getPrice = useMemo(
        () => (symbol: string) => (priceData?.getPrice ? priceData.getPrice(symbol) || 1.0 : 1.0),
        [priceData]
    );

    const selectedCollateralData = useMemo(() => {
        return protocolAssets.find(a => a.symbol === selectedCollateralSymbol);
    }, [protocolAssets, selectedCollateralSymbol]);

    const selectedDebtData = useMemo(() => {
        return protocolAssets.find(a => a.symbol === selectedDebtSymbol);
    }, [protocolAssets, selectedDebtSymbol]);

    // Construct Asset objects for Simulation
    const collateralAsset: Asset | undefined = useMemo(() => {
        if (!selectedCollateralData) return undefined;
        return {
            symbol: selectedCollateralData.symbol,
            protocol: activeProtocol,
            apy: selectedCollateralData.apy, // Supply APY
            maxLTV: selectedCollateralData.ltv || 0.6,
            price: getPrice(selectedCollateralData.symbol)
        };
    }, [selectedCollateralData, activeProtocol, getPrice]);

    const debtAsset: Asset | undefined = useMemo(() => {
        if (!selectedDebtData) return undefined;
        return {
            symbol: selectedDebtData.symbol,
            protocol: activeProtocol,
            apy: -(selectedDebtData.apyBaseBorrow || 0), // Borrow APY (negative for cost)
            maxLTV: 0, // Irrelevant for debt side usually in this sim context
            price: getPrice(selectedDebtData.symbol)
        };
    }, [selectedDebtData, activeProtocol, getPrice]);

    // Loop Net APY Calculation
    const { netApy, healthFactor, liquidationPrice } = useMemo(() => {
        if (!collateralAsset || !debtAsset) {
            return { netApy: '0.00', healthFactor: '0.00', liquidationPrice: '0.00' };
        }
        return simulateLoop(1, leverage[0], collateralAsset, debtAsset);
    }, [collateralAsset, debtAsset, leverage]);

    const isRisky = parseFloat(healthFactor) < 1.1;

    // Handlers
    const handleProtocolChange = (protocol: Protocol) => {
        setActiveProtocol(protocol);
        // Effects will handle defaults
    };

    if (isLoadingYields) {
        return (
            <Card className="w-full max-w-4xl mx-auto bg-[#121216] border border-white/10 shadow-2xl p-12 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#CEFF00]" />
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-4xl mx-auto bg-[#121216] border border-white/10 shadow-2xl overflow-hidden">
            {/* Header Tabs */}
            <div className="flex border-b border-white/5 bg-black/20">
                <button className="flex-1 py-4 text-center font-bold text-[#CEFF00] border-b-2 border-[#CEFF00] bg-[#CEFF00]/5 uppercase tracking-wide text-sm">
                    <span className="mr-2">⚡</span> Yield Booster (Loop)
                </button>
                <button className="flex-1 py-4 text-center font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-wide text-sm">
                    <span className="mr-2">🔄</span> Pay Off (Move)
                </button>
                <button className="flex-1 py-4 text-center font-bold text-muted-foreground hover:text-red-400 transition-colors uppercase tracking-wide text-sm">
                    <span className="mr-2">⚠️</span> Panic Exit
                </button>
            </div>

            <div className="p-8 space-y-8">
                {/* Description & Protocol Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Yield Booster</h3>
                        <p className="text-muted-foreground">Amplify your APY efficiently.</p>
                    </div>
                    {/* Protocol Selector Pills */}
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        {(['Aave', 'Kinza', 'Radiant'] as Protocol[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => handleProtocolChange(p)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all uppercase tracking-wide ${activeProtocol === p
                                    ? 'bg-white text-black shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Selection Row */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Collateral Side */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div> You Supply (Collateral)
                        </label>
                        <div className="relative">
                            <select
                                className="w-full h-16 pl-14 pr-4 bg-white/5 border border-white/10 rounded-xl text-lg font-bold appearance-none hover:bg-white/10 focus:ring-1 focus:ring-[#CEFF00] transition-all outline-none"
                                onChange={(e) => setSelectedCollateralSymbol(e.target.value)}
                                value={selectedCollateralSymbol}
                            >
                                {protocolAssets.map((opt) => (
                                    <option key={`${opt.symbol}-col`} value={opt.symbol}>
                                        {opt.symbol} ({opt.apy.toFixed(2)}% APY)
                                    </option>
                                ))}
                            </select>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <AssetIcon symbol={selectedCollateralSymbol} size={28} />
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm">
                                Amt 0.00
                            </div>
                        </div>
                        <div className="flex justify-between text-xs font-bold px-1">
                            <span className="text-muted-foreground">Supply APY:</span>
                            <span className="text-emerald-400">{selectedCollateralData?.apy.toFixed(2)}%</span>
                        </div>
                    </div>

                    {/* Debt Side */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500"></div> You Borrow (Asset)
                        </label>
                        <div className="relative">
                            <select
                                className="w-full h-16 pl-14 pr-4 bg-white/5 border border-white/10 rounded-xl text-lg font-bold appearance-none hover:bg-white/10 focus:ring-1 focus:ring-red-400/50 transition-all outline-none"
                                value={selectedDebtSymbol}
                                onChange={(e) => setSelectedDebtSymbol(e.target.value)}
                            >
                                {protocolAssets.map((opt) => (
                                    <option key={`${opt.symbol}-debt`} value={opt.symbol}>
                                        {opt.symbol} ({(opt.apyBaseBorrow || 0).toFixed(2)}% Cost)
                                    </option>
                                ))}
                            </select>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <AssetIcon symbol={selectedDebtSymbol} size={28} />
                            </div>
                        </div>
                        <div className="flex justify-between text-xs font-bold px-1">
                            <span className="text-muted-foreground">Borrow Cost:</span>
                            <span className="text-red-500">{selectedDebtData?.apyBaseBorrow?.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* Leverage Slider */}
                <div className="pt-4 space-y-6 bg-black/20 p-6 rounded-xl border border-white/5">
                    <div className="flex justify-between items-end">
                        <label className="text-sm font-bold text-white uppercase tracking-wider">Boost Multiplier</label>
                        <span className="text-3xl font-bold text-[#CEFF00] font-mono">{leverage[0]}x</span>
                    </div>

                    <Slider
                        defaultValue={[1.5]}
                        max={4.0}
                        min={1.1}
                        step={0.1}
                        onValueChange={setLeverage}
                        className="py-4"
                    />

                    <div className="flex justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
                        <span>CONSERVATIVE</span>
                        <span className="text-red-500">AGGRESSIVE</span>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 text-center py-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Net APY</div>
                        <div className="text-2xl font-bold text-[#CEFF00]">{netApy}%</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Health Factor</div>
                        <div className={`text-2xl font-bold ${isRisky ? 'text-red-500' : 'text-emerald-500'}`}>
                            {healthFactor > '100' ? '∞' : healthFactor}
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Liquidation Price</div>
                        <div className="flex justify-center flex-col mt-1">
                            <div className="text-xl font-bold text-white">${liquidationPrice}</div>
                            <div className="text-[10px] text-muted-foreground">Est. price of {selectedCollateralSymbol}</div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="pt-4">
                    <ConnectButton.Custom>
                        {({ account, chain, openConnectModal, authenticationStatus, mounted }) => {
                            const ready = mounted && authenticationStatus !== 'loading';
                            const connected =
                                ready &&
                                account &&
                                chain &&
                                (!authenticationStatus ||
                                    authenticationStatus === 'authenticated');

                            return (
                                <Button
                                    onClick={!connected ? openConnectModal : undefined}
                                    className="w-full h-16 text-xl font-bold bg-[#CEFF00] text-black hover:bg-[#b8e600] rounded-xl shadow-[0_0_30px_rgba(206,255,0,0.3)] hover:scale-[1.01] transition-all uppercase tracking-wider"
                                >
                                    {connected ? 'Execute Strategy' : 'Connect Wallet to Execute'}
                                </Button>
                            );
                        }}
                    </ConnectButton.Custom>
                    <div className="text-center mt-3 flex justify-center items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        Audited by CertiK • Non-Custodial • Flashloan Powered
                    </div>
                </div>
            </div>
        </Card>
    );
}
