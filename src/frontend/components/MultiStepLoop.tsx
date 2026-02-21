'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { AssetIcon } from "@/components/ui/asset-icon";
import { useYields } from "@/hooks/useYields";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import {
    TrendingUp,
    ArrowRight,
    Check,
    ChevronDown,
    Loader2,
    Layers,
    Shield,
    Zap,
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import {
    AAVE_COMPTROLLER,
    COMPTROLLER_ABI,
    getProtocolAddress,
    UNDERLYING_TOKENS,
    AAVE_VTOKENS,
    DEX_ROUTER,
    DEX_ROUTER_ABI,
    ERC20_ABI,
    VTOKEN_ABI,
    VETH_ABI,
    KINZA_POOL_ABI,
    RADIANT_POOL_ABI,
    getApprovalTarget
} from '@/lib/pool-config';
import { RiskMonitor } from './RiskMonitor';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { toPlainString, formatSmallNumber } from "@/lib/utils";

// Custom Dropdown for Token Selection
function TokenSelect({ value, options, onChange, label, disabled = false }: {
    value: string,
    options: string[],
    onChange: (val: string) => void,
    label: string,
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{label}</label>
            <div className="relative">
                <button
                    disabled={disabled}
                    onClick={() => setOpen(!open)}
                    className="w-full h-12 px-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <div className="flex items-center gap-2">
                        <AssetIcon symbol={value} size={24} />
                        <span className="font-bold text-sm">{value}</span>
                    </div>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && !disabled && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
                        <div className="absolute top-full left-0 w-full mt-1 bg-[#121216] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                            {options.map((opt) => (
                                <div
                                    key={opt}
                                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors ${value === opt ? 'bg-[#CEFF00]/10' : ''}`}
                                    onClick={() => { onChange(opt); setOpen(false); }}
                                >
                                    <AssetIcon symbol={opt} size={20} />
                                    <span className={`text-sm ${value === opt ? 'font-bold text-[#CEFF00]' : 'text-white'}`}>{opt}</span>
                                    {value === opt && <Check size={14} className="text-[#CEFF00] ml-auto" />}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

interface Step {
    id: number;
    title: string;
    description: string;
    status: StepStatus;
    actionAmount?: string; // Pre-calculated amount for this step
}

export function MultiStepLoop() {
    const { address } = useAccount();
    const { toast } = useToast();
    const { openConnectModal } = useConnectModal();
    const { data: yields } = useYields();
    const { data: priceData } = useTokenPrices();
    const getPrice = useMemo(
        () => priceData?.getPrice || (() => 0),
        [priceData]
    );
    const isProtocol = (value: string): value is 'aave' | 'kinza' | 'radiant' =>
        value === 'aave' || value === 'kinza' || value === 'radiant';

    const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    // -- State --
    const [protocol, setProtocol] = useState<'aave' | 'kinza' | 'radiant'>('aave');
    const [tokenA, setTokenA] = useState('USDC'); // Supply
    const [tokenB, setTokenB] = useState('USDT'); // Borrow
    const [inputToken, setInputToken] = useState('ETH');
    const [amount, setAmount] = useState('');
    const [leverage, setLeverage] = useState(1.5);
    const [isExecuting, setIsExecuting] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isApproving, setIsApproving] = useState(false);
    const lastProcessedHash = useRef<string | undefined>(undefined);

    // -- Wallet Balance Hooks --
    const { data: nativeBalance } = useBalance({
        address,
        query: { enabled: !!address && inputToken === 'ETH' }
    });

    const { data: tokenBalanceRaw } = useReadContract({
        address: UNDERLYING_TOKENS[inputToken],
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && inputToken !== 'ETH' && !!UNDERLYING_TOKENS[inputToken] }
    });

    const walletBalance = useMemo(() => {
        if (!address) return 0;
        if (inputToken === 'ETH') return parseFloat(nativeBalance?.formatted || '0');
        if (tokenBalanceRaw) return parseFloat(formatUnits(tokenBalanceRaw as bigint, 18));
        return 0;
    }, [address, inputToken, nativeBalance, tokenBalanceRaw]);

    const searchParams = useSearchParams();

    // -- URL Param Sync --
    useEffect(() => {
        const p = searchParams.get('protocol');
        const s = searchParams.get('supply');
        const b = searchParams.get('borrow');

        if (p && isProtocol(p)) {
            queueMicrotask(() => setProtocol(p));
        }
        if (s) queueMicrotask(() => setTokenA(s));
        if (b) queueMicrotask(() => setTokenB(b));

        // If we have params, we might want to scroll to the section
        if (p || s || b) {
            const el = document.getElementById('looper-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    }, [searchParams]);

    // -- Effects for Stepper --
    useEffect(() => {
        if (isConfirmed && isExecuting && hash && hash !== lastProcessedHash.current) {
            lastProcessedHash.current = hash;

            if (isApproving) {
                toast({
                    title: "Approval Confirmed",
                    description: "You can now proceed with the action.",
                });
                queueMicrotask(() => setIsApproving(false));
            } else {
                toast({
                    title: "Step Completed",
                    description: "Moving to next step...",
                });
                queueMicrotask(() => setCurrentStepIndex((prev) => prev + 1));
            }
        }
    }, [isConfirmed, isExecuting, isApproving, hash, toast]);

    // -- Calculated Data --
    const protocolYields = useMemo(() => {
        if (!yields) return [];
        return yields.filter(y => y.project.toLowerCase().includes(protocol));
    }, [yields, protocol]);

    const availableTokens = useMemo(() => {
        return Array.from(new Set(protocolYields.map(y => y.symbol))).sort();
    }, [protocolYields]);

    const walletTokens = ['ETH', 'USDT', 'USDC', 'ETH', 'WBTC', 'FDUSD'];

    const poolA = protocolYields.find(y => y.symbol === tokenA);
    const poolB = protocolYields.find(y => y.symbol === tokenB);

    const ltv = poolA?.ltv || 0.8;
    const maxLeverage = Math.min(4, 1 / (1 - ltv));

    const priceA = getPrice(tokenA);
    const priceB = getPrice(tokenB);
    const priceInput = getPrice(inputToken);

    const principalUSD = (parseFloat(amount) || 0) * priceInput;
    const totalExposureUSD = principalUSD * leverage;
    const totalDebtUSD = totalExposureUSD - principalUSD;

    const healthFactor = totalDebtUSD > 0 ? (totalExposureUSD * ltv) / totalDebtUSD : 999;
    const netApy = principalUSD > 0
        ? (((poolA?.apy || 0) * totalExposureUSD) - ((poolB?.apyBaseBorrow || 0) * totalDebtUSD)) / principalUSD
        : 0;

    // -- Allowance Checks --
    const { data: allowanceInput } = useReadContract({
        address: inputToken !== 'ETH' ? UNDERLYING_TOKENS[inputToken] : undefined,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, DEX_ROUTER] : undefined,
        query: { enabled: !!address && inputToken !== 'ETH' }
    });

    const approvalTarget = useMemo(() => getApprovalTarget(protocol, tokenA), [protocol, tokenA]);
    const { data: allowanceA } = useReadContract({
        address: tokenA !== 'ETH' ? UNDERLYING_TOKENS[tokenA] : undefined,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && approvalTarget ? [address, approvalTarget] : undefined,
        query: { enabled: !!address && !!approvalTarget && tokenA !== 'ETH' }
    });

    // -- Aave Specific: Check Collateral --
    const { data: assetsIn } = useReadContract({
        address: AAVE_COMPTROLLER,
        abi: COMPTROLLER_ABI,
        functionName: 'getAssetsIn',
        args: address ? [address] : undefined,
        query: { enabled: !!address && protocol === 'aave' }
    });

    const isCollateralEnabled = useMemo(() => {
        if (protocol !== 'aave' || !assetsIn) return true;
        const vToken = AAVE_VTOKENS[tokenA];
        return assetsIn.some(a => a.toLowerCase() === vToken?.toLowerCase());
    }, [protocol, assetsIn, tokenA]);

    // -- Dynamic Steps --
    const steps: Step[] = useMemo(() => {
        const s: Step[] = [];
        let id = 1;

        const pA = getPrice(tokenA);
        const pB = getPrice(tokenB);
        const pInput = getPrice(inputToken);
        const principal = (parseFloat(amount) || 0);

        if (principal <= 0) return [];

        // Cumulative trackers for calculation
        let currentCollateralUSD = principal * pInput;
        let currentDebtUSD = 0;
        const targetDebtUSD = (principal * pInput * leverage) - (principal * pInput);

        // Step 1: Swap if input != Token A
        if (inputToken !== tokenA) {
            s.push({
                id: id++,
                title: `Swap ${inputToken} to ${tokenA}`,
                description: `Convert your initial deposit to the supply asset.`,
                status: 'pending',
                actionAmount: amount
            });
        }

        // Step 2: Initial Deposit
        s.push({
            id: id++,
            title: `Deposit ${tokenA}`,
            description: `Supply ${tokenA} to ${protocol.toUpperCase()} as collateral.`,
            status: 'pending',
            actionAmount: amount
        });

        // Step 3: Enable Collateral (Aave only)
        if (protocol === 'aave' && !isCollateralEnabled) {
            s.push({
                id: id++,
                title: `Enable ${tokenA} as Collateral`,
                description: `Allow Aave to use your ${tokenA} for borrowing.`,
                status: 'pending'
            });
        }

        // --- Dynamic Looping Cycles ---
        const numCycles = Math.max(1, Math.ceil((leverage - 1) / 0.6));

        for (let i = 0; i < numCycles; i++) {
            const cycleNum = i + 1;

            // Calculate how much we can borrow in this cycle
            // Max allowed = collateral * LTV * 0.95
            const maxAllowedBorrowUSD = currentCollateralUSD * ltv * 0.95;
            let cycleBorrowUSD = Math.max(0, maxAllowedBorrowUSD - currentDebtUSD);

            // Don't borrow more than needed to reach target total debt
            const remainingNeededUSD = Math.max(0, targetDebtUSD - currentDebtUSD);
            if (cycleBorrowUSD > remainingNeededUSD) {
                cycleBorrowUSD = remainingNeededUSD;
            }

            if (cycleBorrowUSD < 0.01 && i > 0) break; // Reached goal

            const cycleBorrowTokenAmount = toPlainString(cycleBorrowUSD / pB);

            // 1. Borrow
            s.push({
                id: id++,
                title: cycleNum === 1 ? `Borrow ${tokenB}` : `Borrow ${tokenB} (Cycle ${cycleNum})`,
                description: `Borrow ${tokenB} against your collateral.`,
                status: 'pending',
                actionAmount: cycleBorrowTokenAmount
            });

            // 2. Swap to A
            s.push({
                id: id++,
                title: `Loop Swap (Cycle ${cycleNum})`,
                description: `Swap borrowed ${tokenB} back to ${tokenA} to complete the loop.`,
                status: 'pending',
                actionAmount: cycleBorrowTokenAmount
            });

            // 3. Deposit again
            s.push({
                id: id++,
                title: `Loop Deposit (Cycle ${cycleNum})`,
                description: `Supply more ${tokenA} to further increase exposure.`,
                status: 'pending',
                actionAmount: toPlainString(cycleBorrowUSD / pA)
            });

            // Update cumulative trackers for next loop calc
            currentDebtUSD += cycleBorrowUSD;
            currentCollateralUSD += cycleBorrowUSD;
        }

        return s;
    }, [inputToken, tokenA, tokenB, protocol, isCollateralEnabled, leverage, amount, ltv, getPrice]);

    const handleStart = () => {
        if (!address) {
            openConnectModal?.();
            return;
        }
        setIsExecuting(true);
        setCurrentStepIndex(0);
    };

    const executeStep = async () => {
        if (!address) return;
        const currentStep = steps[currentStepIndex];
        if (!currentStep) return;

        console.log(`Executing step ${currentStepIndex}: ${currentStep.title}`, {
            actionAmount: currentStep.actionAmount,
            currentStep
        });

        const isSwap = currentStep.title.includes('Swap');
        const isDeposit = currentStep.title.includes('Deposit');

        try {
            toast({
                title: "Initiating Transaction",
                description: `Please confirm the ${currentStep.title} in your wallet.`,
            });
            // Approval Logic
            if (isSwap && inputToken !== 'ETH') {
                const stepAmt = currentStep.actionAmount || amount;
                const required = parseUnits(stepAmt, 18);
                if ((allowanceInput || BigInt(0)) < required) {
                    setIsApproving(true);
                    writeContract({
                        address: UNDERLYING_TOKENS[inputToken],
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [DEX_ROUTER, maxUint256]
                    });
                    return;
                }
            }

            if (isDeposit && tokenA !== 'ETH' && approvalTarget) {
                const stepAmt = currentStep.actionAmount || amount;
                const required = parseUnits(stepAmt, 18);
                if ((allowanceA || BigInt(0)) < required) {
                    setIsApproving(true);
                    writeContract({
                        address: UNDERLYING_TOKENS[tokenA],
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [approvalTarget, maxUint256]
                    });
                    return;
                }
            }

            if (isSwap) {
                const fromToken = currentStep.title.includes('Loop Swap') ? tokenB : inputToken;
                const toToken = tokenA;
                const stepAmount = currentStep.actionAmount || amount;

                const path = [
                    fromToken === 'ETH' ? UNDERLYING_TOKENS['WETH'] : UNDERLYING_TOKENS[fromToken],
                    toToken === 'ETH' ? UNDERLYING_TOKENS['WETH'] : UNDERLYING_TOKENS[toToken]
                ];
                const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
                const swapAmount = parseUnits(stepAmount, 18);

                if (fromToken === 'ETH') {
                    writeContract({
                        address: DEX_ROUTER,
                        abi: DEX_ROUTER_ABI,
                        functionName: 'swapExactETHForTokens',
                        args: [BigInt(0), path, address, deadline],
                        value: swapAmount
                    });
                } else {
                    writeContract({
                        address: DEX_ROUTER,
                        abi: DEX_ROUTER_ABI,
                        functionName: 'swapExactTokensForTokens',
                        args: [swapAmount, BigInt(0), path, address, deadline]
                    });
                }
            } else if (isDeposit) {
                const target = getProtocolAddress(protocol, tokenA);
                if (!target) return;
                const stepAmount = currentStep.actionAmount || amount;
                const depositRaw = parseUnits(stepAmount, 18);

                if (protocol === 'aave') {
                    if (tokenA === 'ETH') {
                        writeContract({ address: target, abi: VETH_ABI, functionName: 'mint', value: depositRaw });
                    } else {
                        writeContract({ address: target, abi: VTOKEN_ABI, functionName: 'mint', args: [depositRaw] });
                    }
                } else {
                    const abi = protocol === 'kinza' ? KINZA_POOL_ABI : RADIANT_POOL_ABI;
                    writeContract({
                        address: target,
                        abi: abi,
                        functionName: protocol === 'kinza' ? 'supply' : 'deposit',
                        args: [UNDERLYING_TOKENS[tokenA], depositRaw, address, 0]
                    });
                }
            } else if (currentStep.title.includes('Collateral')) {
                writeContract({
                    address: AAVE_COMPTROLLER,
                    abi: COMPTROLLER_ABI,
                    functionName: 'enterMarkets',
                    args: [[AAVE_VTOKENS[tokenA]]]
                });
            } else if (currentStep.title.includes('Borrow')) {
                const target = getProtocolAddress(protocol, tokenB);
                if (!target) return;
                const stepAmount = currentStep.actionAmount || toPlainString(totalDebtUSD / priceB);
                const borrowAmount = parseUnits(stepAmount, 18);

                if (protocol === 'aave') {
                    writeContract({
                        address: target,
                        abi: VTOKEN_ABI,
                        functionName: 'borrow',
                        args: [borrowAmount]
                    });
                } else {
                    const abi = protocol === 'kinza' ? KINZA_POOL_ABI : RADIANT_POOL_ABI;
                    writeContract({
                        address: target,
                        abi: abi,
                        functionName: 'borrow',
                        args: [UNDERLYING_TOKENS[tokenB], borrowAmount, BigInt(2), 0, address]
                    });
                }
            }
        } catch (err: unknown) {
            console.error("Execution error:", err);
            const message = typeof err === 'object' && err && 'message' in err
                ? String((err as { message?: unknown }).message ?? '')
                : '';
            const msg = message || "Transaction failed. Please check your wallet.";
            toast({
                title: "Execution Error",
                description: msg.length > 100 ? msg.substring(0, 100) + "..." : msg,
                variant: "destructive"
            });
            setIsApproving(false);
        }
    };

    return (
        <Card id="looper-section" className="w-full bg-[#0f0f12] border-white/5 shadow-2xl overflow-hidden font-outfit scroll-mt-24">
            <CardHeader className="border-b border-white/5 pb-6 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#CEFF00]/10 border border-[#CEFF00]/20">
                                <TrendingUp className="text-[#CEFF00] w-6 h-6" />
                            </div>
                            Multi-Step Yield Looper
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1 ml-12">
                            Guided strategy execution for maximum transparency and control.
                        </CardDescription>
                    </div>
                    {/* Protocol Selector */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {(['aave', 'kinza', 'radiant'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setProtocol(p)}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${protocol === p ? 'bg-[#CEFF00] text-black' : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-8 space-y-8">
                {/* 1. Selection Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <div className="flex items-center gap-2 text-[#CEFF00] mb-2 font-bold text-sm uppercase tracking-widest">
                            <Layers size={16} /> Loop Configuration
                        </div>
                        <div className="flex gap-4">
                            <TokenSelect
                                label="Supply Asset (A)"
                                value={tokenA}
                                options={availableTokens}
                                onChange={setTokenA}
                                disabled={isExecuting}
                            />
                            <div className="flex items-end pb-3 text-muted-foreground">
                                <ArrowRight size={20} />
                            </div>
                            <TokenSelect
                                label="Borrow Asset (B)"
                                value={tokenB}
                                options={availableTokens}
                                onChange={setTokenB}
                                disabled={isExecuting}
                            />
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <div className="flex items-center gap-2 text-[#CEFF00] mb-2 font-bold text-sm uppercase tracking-widest">
                            <Shield size={16} /> Initial Deposit
                        </div>
                        <div className="flex gap-4">
                            <TokenSelect
                                label="Token from Wallet"
                                value={inputToken}
                                options={walletTokens}
                                onChange={setInputToken}
                                disabled={isExecuting}
                            />
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Amount</label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        disabled={isExecuting}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full h-12 px-4 pr-24 rounded-xl border border-white/10 bg-white/5 focus:ring-1 focus:ring-[#CEFF00]/50 outline-none font-mono text-right text-lg transition-all"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">Amt</span>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        <button
                                            onClick={() => setAmount(toPlainString(walletBalance / 2))}
                                            className="px-2 py-1 text-[9px] font-black uppercase rounded bg-white/10 hover:bg-[#CEFF00]/20 hover:text-[#CEFF00] border border-white/10 transition-all"
                                        >
                                            Half
                                        </button>
                                        <button
                                            onClick={() => {
                                                const max = inputToken === 'ETH' ? Math.max(0, walletBalance - 0.01) : walletBalance;
                                                setAmount(toPlainString(max));
                                            }}
                                            className="px-2 py-1 text-[9px] font-black uppercase rounded bg-white/10 hover:bg-[#CEFF00]/20 hover:text-[#CEFF00] border border-white/10 transition-all"
                                        >
                                            Max
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase italic">
                                        Wallet: <span className="text-white/60 not-italic">{formatSmallNumber(walletBalance)} {inputToken}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase italic">
                                        ≈ ${((parseFloat(amount) || 0) * getPrice(inputToken)).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Leverage & Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Slider */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-white">Target Leverage</span>
                                <span className="text-2xl font-black text-[#CEFF00] font-mono">{leverage.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max={maxLeverage.toFixed(2)}
                                step="0.05"
                                value={leverage}
                                disabled={isExecuting}
                                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                                className="w-full accent-[#CEFF00] h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Low Risk</span>
                                <span className="text-red-500/80">Max Leveraged</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Exposure</span>
                                <span className="text-lg font-bold text-white">${totalExposureUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Total Debt</span>
                                <span className="text-lg font-bold text-white">${totalDebtUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Net APY</span>
                                <span className="text-lg font-bold text-[#CEFF00]">+{netApy.toFixed(2)}%</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">LTV Used</span>
                                <span className="text-lg font-bold text-white">{((1 - (1 / leverage)) * 100).toFixed(0)}%</span>
                            </div>
                        </div>

                        {/* Strategy Insights Section */}
                        <div className="p-5 rounded-2xl bg-[#CEFF00]/5 border border-[#CEFF00]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[#CEFF00] text-xs font-black uppercase tracking-tighter">
                                    <Zap size={14} fill="#CEFF00" /> Strategy Insights
                                </div>
                                <p className="text-[11px] text-white/50 leading-tight pr-4"> Optimized multi-cycle adjustments to reach target leverage while preserving health.</p>
                            </div>
                            <div className="flex gap-6">
                                <div className="space-y-1">
                                    <div className="text-[9px] uppercase font-bold text-muted-foreground">Required Loops</div>
                                    <div className="text-sm font-black text-white">{Math.max(1, Math.ceil((leverage - 1) / 0.6))} Multi-Cycles</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] uppercase font-bold text-muted-foreground">Max Potential APY</div>
                                    <div className="text-sm font-black text-[#CEFF00]">
                                        {(() => {
                                            const theoreticalMaxLTV = ltv * 0.95; // 95% of asset LTV
                                            const maxLeverageVal = 1 / (1 - theoreticalMaxLTV);
                                            const maxExposure = 100 * maxLeverageVal;
                                            const maxDebt = maxExposure - 100;
                                            const aA = poolA?.apy || 0;
                                            const aB = poolB?.apyBaseBorrow || 0;
                                            const mAPY = ((maxExposure * aA) - (maxDebt * aB)) / 100;
                                            return mAPY.toFixed(2);
                                        })()}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Health Factor */}
                    <div className="flex flex-col justify-center">
                        <RiskMonitor
                            healthFactor={healthFactor}
                            liquidationThreshold={ltv}
                            currentPrice={priceA}
                            liquidationPrice={totalExposureUSD > 0 ? (totalDebtUSD / (totalExposureUSD / priceA * ltv)) : 0}
                            pairName={`${tokenA}/USD`}
                            dropLabel="Max Drop"
                            projectedDrop={healthFactor > 1 ? (1 - 1 / healthFactor) * 100 : 0}
                        />
                    </div>
                </div>

                {/* 3. Execution Stepper */}
                <div className={`transition-all duration-500 overflow-hidden ${isExecuting ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-8 rounded-3xl bg-white/[0.02] border border-[#CEFF00]/10 relative">
                        <div className="absolute top-0 right-0 p-6">
                            <div className="text-4xl font-black text-[#CEFF00]/10">{(currentStepIndex / steps.length * 100).toFixed(0)}%</div>
                        </div>

                        <div className="space-y-8 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-white/10" />

                            {steps.map((step, idx) => (
                                <div key={step.id} className={`flex gap-6 relative transition-all duration-300 ${idx > currentStepIndex ? 'opacity-30' : 'opacity-100'}`}>
                                    <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#121216] ${idx < currentStepIndex ? 'bg-[#CEFF00] text-black shadow-[0_0_15px_rgba(206,255,0,0.5)]' :
                                        idx === currentStepIndex ? 'bg-white border-[#CEFF00] text-black' : 'bg-white/5 text-muted-foreground'
                                        }`}>
                                        {idx < currentStepIndex ? <Check size={16} strokeWidth={4} /> : idx + 1}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <h3 className={`font-bold transition-colors ${idx === currentStepIndex ? 'text-[#CEFF00] text-lg' : 'text-white'}`}>
                                            {step.title}
                                        </h3>
                                        {idx === currentStepIndex && (
                                            <div className="mt-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-left-2 transition-all">
                                                {step.description}
                                                <div className="mt-4">
                                                    <Button
                                                        size="sm"
                                                        className="bg-[#CEFF00] text-black hover:bg-[#b8e600] font-bold"
                                                        onClick={executeStep}
                                                        disabled={isWritePending || isConfirming}
                                                    >
                                                        {isWritePending || isConfirming ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Processing...
                                                            </>
                                                        ) : (
                                                            (() => {
                                                                const s = steps[currentStepIndex];
                                                                const stepAmt = s.actionAmount || amount;
                                                                if (s.title.includes('Swap') && inputToken !== 'ETH' && (allowanceInput || BigInt(0)) < parseUnits(stepAmt, 18)) {
                                                                    return `Approve ${inputToken}`;
                                                                }
                                                                if (s.title.includes('Deposit') && tokenA !== 'ETH' && (allowanceA || BigInt(0)) < parseUnits(stepAmt, 18)) {
                                                                    return `Approve ${tokenA}`;
                                                                }
                                                                return 'Confirm Transaction';
                                                            })()
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {!isExecuting && (
                    <Button
                        onClick={handleStart}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="w-full h-16 rounded-2xl bg-[#CEFF00] text-black hover:bg-[#b8e600] text-xl font-black shadow-2xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                        START LOOP STRATEGY
                        <TrendingUp className="ml-2 w-6 h-6" />
                    </Button>
                )}

                {isExecuting && currentStepIndex === steps.length && (
                    <div className="text-center p-8 space-y-4 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-[#CEFF00] rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(206,255,0,0.4)]">
                            <Check className="text-black w-10 h-10" strokeWidth={3} />
                        </div>
                        <h2 className="text-3xl font-black text-white">Strategy Deployed!</h2>
                        <p className="text-muted-foreground">Your leveraged position is now active on {protocol.toUpperCase()}.</p>
                        <Button
                            variant="outline"
                            className="mt-6 border-white/10 hover:bg-white/5"
                            onClick={() => setIsExecuting(false)}
                        >
                            Start New One
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
