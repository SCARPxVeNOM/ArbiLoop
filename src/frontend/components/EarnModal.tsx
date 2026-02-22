"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Loader2, Check, ArrowUpDown, AlertTriangle, Shield, ExternalLink, ArrowRight, ShieldAlert, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useBalance } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import {
    ERC20_ABI,
    AAVE_POOL, AAVE_POOL_ABI, AAVE_DATA_PROVIDER,
    RADIANT_LENDING_POOL, RADIANT_POOL_ABI,
    WETH_GATEWAY_ABI, AAVE_GATEWAY, RADIANT_GATEWAY,
    getUnderlyingAddress, getApprovalTarget,
} from "@/lib/pool-config";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatMoney, formatSmallNumber, getTokenDecimals, toPlainString, cn } from "@/lib/utils";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useAggregatedHealth } from "@/hooks/useAggregatedHealth";
import { getExplorerTxUrl, upsertActivityRecord, updateActivityStatus } from "@/lib/activity";

interface EarnModalProps {
    isOpen: boolean;
    onClose: () => void;
    pool: {
        symbol: string;
        project: string;
        apy: number;
        tvlUsd: number;
        userDeposited?: number;
        userDepositedUSD?: number;
        ltv?: number;
    };
}

interface EarnModalContentProps {
    onClose: () => void;
    pool: any;
    isEmbedded?: boolean;
    initialTab?: "deposit" | "withdraw";
}

export function EarnModalContent({ onClose, pool, isEmbedded = false, initialTab = "deposit" }: EarnModalContentProps) {
    const { toast } = useToast();
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { openConnectModal } = useConnectModal();
    const [amount, setAmount] = useState("");
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">(initialTab);
    const [step, setStep] = useState<"idle" | "approving" | "mining" | "success">("idle");
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    const [submittedTxMeta, setSubmittedTxMeta] = useState<{
        action: "deposit" | "withdraw";
        amount: number;
        amountUsd: number;
    } | null>(null);
    const { data: prices } = useTokenPrices();

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Protocol detection
    const isAave = pool.project === 'aave-v3';
    const isRadiant = pool.project === 'radiant-v2';
    const isNative = pool.symbol === 'ETH' || pool.symbol === 'WETH';
    const decimals = getTokenDecimals(pool.symbol);
    const tokenPrice = prices ? prices.getPrice(pool.symbol) : 0;

    // Underlying token address (for ERC20 balance + approval)
    const underlyingAddress = getUnderlyingAddress(pool.symbol, pool.project);
    const approvalTarget = getApprovalTarget(pool.project, pool.symbol);

    // Transaction hooks
    const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (!hash || !address || !submittedTxMeta) return;
        upsertActivityRecord(address, chainId, {
            hash,
            protocol: pool.project,
            action: submittedTxMeta.action,
            asset: pool.symbol,
            amount: submittedTxMeta.amount,
            amountUsd: submittedTxMeta.amountUsd,
            status: 'pending',
            explorerUrl: getExplorerTxUrl(chainId, hash),
            summary: `${submittedTxMeta.action} ${submittedTxMeta.amount.toFixed(4)} ${pool.symbol}`,
        });
    }, [address, chainId, hash, pool.project, pool.symbol, submittedTxMeta]);

    // WALLET BALANCE
    const { data: balanceData, refetch: refetchBalance } = useBalance({
        address,
        query: { enabled: !!address && isNative }
    });

    const { data: tokenBalanceRaw, refetch: refetchToken } = useReadContract({
        address: underlyingAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !isNative && !!underlyingAddress }
    });

    let walletBalance = 0;
    if (isNative && balanceData) {
        walletBalance = parseFloat(balanceData.formatted);
    } else if (tokenBalanceRaw) {
        walletBalance = parseFloat(formatUnits(tokenBalanceRaw, decimals));
    }

    // DEPOSITED BALANCE
    const { data: aaveUserReserve, refetch: refetchAave } = useReadContract({
        address: AAVE_DATA_PROVIDER,
        abi: [{ name: 'getUserReserveData', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }, { name: 'user', type: 'address' }], outputs: [{ name: 'currentATokenBalance', type: 'uint256' }, { name: 'currentStableDebtBalance', type: 'uint256' }, { name: 'currentVariableDebtBalance', type: 'uint256' }, { name: 'principalStableDebt', type: 'uint256' }, { name: 'scaledVariableDebt', type: 'uint256' }, { name: 'stableBorrowRate', type: 'uint256' }, { name: 'liquidityRate', type: 'uint256' }, { name: 'stableRateLastUpdated', type: 'uint40' }, { name: 'usedAsCollateralEnabled', type: 'bool' }] }] as const,
        functionName: 'getUserReserveData',
        args: (underlyingAddress || isNative) && address ? [
            isNative ? '0xCC650b486f723C924370656b509a82bD69526739' as `0x${string}` : underlyingAddress!,
            address
        ] : undefined,
        query: { enabled: !!address && isAave && (!!underlyingAddress || isNative), refetchInterval: 10000 }
    });

    const { data: aaveReserveData } = useReadContract({
        address: AAVE_POOL,
        abi: [{ name: 'getReserveData', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: 'configuration', type: 'uint256' }, { name: 'liquidityIndex', type: 'uint128' }, { name: 'currentLiquidityRate', type: 'uint128' }, { name: 'variableBorrowIndex', type: 'uint128' }, { name: 'currentVariableBorrowRate', type: 'uint128' }, { name: 'currentStableBorrowRate', type: 'uint128' }, { name: 'lastUpdateTimestamp', type: 'uint40' }, { name: 'aTokenAddress', type: 'address' }, { name: 'stableDebtTokenAddress', type: 'address' }, { name: 'variableDebtTokenAddress', type: 'address' }, { name: 'interestRateStrategyAddress', type: 'address' }, { name: 'id', type: 'uint8' }] }] as const,
        functionName: 'getReserveData',
        args: (underlyingAddress || isNative) ? [
            isNative ? '0xCC650b486f723C924370656b509a82bD69526739' as `0x${string}` : underlyingAddress!
        ] : undefined,
        query: { enabled: !!address && isAave && (!!underlyingAddress || isNative), staleTime: 60 * 60 * 1000 }
    });

    const { data: radiantReserveData } = useReadContract({
        address: RADIANT_LENDING_POOL,
        abi: [{ name: 'getReserveData', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: 'configuration', type: 'uint256' }, { name: 'liquidityIndex', type: 'uint128' }, { name: 'currentLiquidityRate', type: 'uint128' }, { name: 'variableBorrowIndex', type: 'uint128' }, { name: 'currentVariableBorrowRate', type: 'uint128' }, { name: 'currentStableBorrowRate', type: 'uint128' }, { name: 'lastUpdateTimestamp', type: 'uint40' }, { name: 'aTokenAddress', type: 'address' }, { name: 'stableDebtTokenAddress', type: 'address' }, { name: 'variableDebtTokenAddress', type: 'address' }, { name: 'interestRateStrategyAddress', type: 'address' }, { name: 'id', type: 'uint8' }] }] as const,
        functionName: 'getReserveData',
        args: (underlyingAddress || isNative) ? [
            isNative ? '0xCC650b486f723C924370656b509a82bD69526739' as `0x${string}` : underlyingAddress!
        ] : undefined,
        query: { enabled: !!address && isRadiant && (!!underlyingAddress || isNative), staleTime: 60 * 60 * 1000 }
    });

    const aaveATokenAddress = aaveReserveData ? (aaveReserveData as unknown as any[])[7] as `0x${string}` : undefined;
    const radiantATokenAddress = radiantReserveData ? (radiantReserveData as unknown as any[])[7] as `0x${string}` : undefined;
    const { data: radiantATokenBalance, refetch: refetchRadiant } = useReadContract({
        address: radiantATokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && isRadiant && !!radiantATokenAddress, refetchInterval: 10000 }
    });

    let depositedAmount = 0;
    let depositedAmountUSD = 0;

    if (isAave && aaveUserReserve) {
        const data = aaveUserReserve as unknown as any[];
        const aTokenBal = data[0] as bigint;
        depositedAmount = parseFloat(formatUnits(aTokenBal, decimals));
    } else if (isRadiant && radiantATokenBalance) {
        depositedAmount = parseFloat(formatUnits(radiantATokenBalance, decimals));
    }

    if (depositedAmount === 0 && pool.userDeposited && pool.userDeposited > 0) {
        depositedAmount = pool.userDeposited;
    }
    depositedAmountUSD = depositedAmount * tokenPrice;

    // HEALTH & SAFETY
    const { aave, radiant, isLoading: isHealthLoading, refetch: refetchHealth } = useAggregatedHealth();
    const activeHealth = isAave ? aave : radiant;
    const protocolDebt = activeHealth.debtUSD;
    const protocolPowerUSD = activeHealth.borrowPowerUSD;
    const assetLTV = pool.ltv || 0.7;

    const safeWithdrawPower = Math.max(0, protocolPowerUSD - (protocolDebt / 0.95));
    const safeMaxWithdrawAmount = assetLTV > 0 ? safeWithdrawPower / (assetLTV * tokenPrice) : depositedAmount;
    const maxSafe = Math.min(depositedAmount, safeMaxWithdrawAmount);

    const withdrawAmount = parseFloat(amount) || 0;
    const withdrawUSD = withdrawAmount * tokenPrice;

    const newHF = useMemo(() => {
        if (!withdrawUSD && !amount) return activeHealth.healthFactor || 10;
        const changeUSD = (parseFloat(amount) || 0) * tokenPrice;
        if (changeUSD <= 0) return activeHealth.healthFactor || 10;

        let newPower = protocolPowerUSD;
        let newDebt = protocolDebt;
        if (activeTab === 'deposit') {
            newPower += changeUSD * assetLTV;
        } else {
            newPower = Math.max(0, protocolPowerUSD - (changeUSD * assetLTV));
        }

        if (newDebt <= 0) return 10;
        return newPower / newDebt;
    }, [activeTab, protocolPowerUSD, protocolDebt, amount, assetLTV, activeHealth.healthFactor, tokenPrice]);

    const isRisky = newHF < 1.1;

    // ALLOWANCE LOGIC
    // For deposits: Check underlying -> approvalTarget
    // For native withdrawals: Check aToken -> Gateway
    const isNativeWithdraw = activeTab === 'withdraw' && isNative && (isAave || isRadiant);
    const allowanceAddress = isNativeWithdraw
        ? (isAave ? aaveATokenAddress : radiantATokenAddress)
        : underlyingAddress;
    const allowanceSpender = isNativeWithdraw
        ? (isAave ? AAVE_GATEWAY : RADIANT_GATEWAY)
        : approvalTarget;

    const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
        address: allowanceAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && allowanceSpender ? [address, allowanceSpender] : undefined,
        query: { enabled: !!address && !!allowanceAddress && !!allowanceSpender }
    });

    useEffect(() => {
        if (isConfirmed) {
            if (hash && address && submittedTxMeta) {
                updateActivityStatus(address, chainId, hash, 'confirmed');
                setSubmittedTxMeta(null);
            }
            if (step === 'approving') {
                setStep('idle');
                refetchAllowance();
                toast({
                    title: "Asset Approved",
                    description: `You can now proceed to ${activeTab}.`,
                });
            } else {
                setStep("success");
                refetchAave?.(); refetchRadiant?.();
                refetchBalance?.(); refetchToken?.(); refetchHealth?.();
            }
        } else if (isConfirming || isPending) {
            if (step !== 'approving' && step !== 'success') setStep("mining");
        }
    }, [isConfirmed, isConfirming, isPending, step, refetchAllowance, refetchAave, refetchRadiant, refetchBalance, refetchToken, refetchHealth, activeTab, toast, hash, address, chainId, submittedTxMeta]);

    const handleAction = useCallback(() => {
        if (!isConnected) { openConnectModal?.(); return; }
        const amountNum = parseFloat(amount || '0');
        if (amountNum <= 0) return;
        const amountBig = parseUnits(amount, decimals);
        const nextMeta = {
            action: activeTab as "deposit" | "withdraw",
            amount: amountNum,
            amountUsd: amountNum * tokenPrice,
        };
        setSubmittedTxMeta(null);

        try {
            if (activeTab === 'deposit') {
                const needsApproval = !isNative && underlyingAddress && approvalTarget && (currentAllowance || BigInt(0)) < amountBig;
                if (isAave || isRadiant) {
                    const poolAddress = isAave ? AAVE_POOL : RADIANT_LENDING_POOL;
                    if (isNative) {
                        const gatewayAddress = isAave ? AAVE_GATEWAY : RADIANT_GATEWAY;
                        if (gatewayAddress) {
                            setSubmittedTxMeta(nextMeta);
                            writeContract({ address: gatewayAddress, abi: WETH_GATEWAY_ABI, functionName: 'depositETH', args: [poolAddress, address!, 0], value: amountBig });
                        }
                    } else {
                        if (needsApproval) {
                            setStep('approving');
                            writeContract({ address: underlyingAddress, abi: ERC20_ABI, functionName: 'approve', args: [approvalTarget!, amountBig] });
                        } else {
                            setSubmittedTxMeta(nextMeta);
                            if (isAave) writeContract({ address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'supply', args: [underlyingAddress!, amountBig, address!, 0] });
                            else writeContract({ address: RADIANT_LENDING_POOL, abi: RADIANT_POOL_ABI, functionName: 'deposit', args: [underlyingAddress!, amountBig, address!, 0] });
                        }
                    }
                }
            } else {
                if (isAave || isRadiant) {
                    const poolAddress = isAave ? AAVE_POOL : RADIANT_LENDING_POOL;
                    const gatewayAddress = isAave ? AAVE_GATEWAY : RADIANT_GATEWAY;
                    if (isNative) {
                        const needsWithdrawApproval = (currentAllowance || BigInt(0)) < amountBig;
                        if (needsWithdrawApproval) {
                            setStep('approving');
                            writeContract({ address: allowanceAddress!, abi: ERC20_ABI, functionName: 'approve', args: [allowanceSpender!, maxUint256] });
                        } else {
                            if (gatewayAddress) {
                                setSubmittedTxMeta(nextMeta);
                                writeContract({ address: gatewayAddress, abi: WETH_GATEWAY_ABI, functionName: 'withdrawETH', args: [poolAddress, amountBig, address!] });
                            }
                        }
                    } else {
                        setSubmittedTxMeta(nextMeta);
                        if (isAave) writeContract({ address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [underlyingAddress!, amountBig, address!] });
                        else writeContract({ address: RADIANT_LENDING_POOL, abi: RADIANT_POOL_ABI, functionName: 'withdraw', args: [underlyingAddress!, amountBig, address!] });
                    }
                }
            }
        } catch (e) { console.error(e); }
    }, [amount, activeTab, isConnected, isNative, isAave, isRadiant, address, underlyingAddress, approvalTarget, currentAllowance, decimals, allowanceAddress, allowanceSpender, tokenPrice, writeContract]);

    const isWithdrawBlocked = activeTab === 'withdraw' && maxSafe <= 0 && depositedAmount > 0;
    const maxWithdrawableAvailable = depositedAmount;

    const setHalf = () => {
        const base = activeTab === 'deposit' ? walletBalance : maxWithdrawableAvailable;
        setAmount(toPlainString(base / 2));
    };
    const setMax = () => {
        if (activeTab === 'deposit') {
            const max = isNative && walletBalance > 0.01 ? walletBalance - 0.01 : walletBalance;
            setAmount(toPlainString(max));
        } else {
            setAmount(toPlainString(maxWithdrawableAvailable));
        }
    };

    const amountNum = parseFloat(amount || '0');
    const isButtonDisabled = !amount || amountNum <= 0 || step === 'mining' || step === 'approving' || step === 'success' || isWithdrawBlocked;
    const protocolDisplay = isAave ? 'Aave V3' : isRadiant ? 'Radiant' : pool.project;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {!isEmbedded && (
                    <div className="p-4 md:p-6 pb-2 md:pb-4 border-b border-white/5 bg-[#09090b] sticky top-0 z-20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AssetIcon symbol={pool.symbol} className="w-8 h-8 md:w-10 md:h-10" />
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold">{pool.symbol}</h2>
                                    <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
                                        <span className="uppercase">{protocolDisplay}</span>
                                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                                        <span className="text-blue-400 font-medium">Earn Market</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="px-4 md:px-6 pt-4 md:pt-6 mb-3 md:mb-5">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-0 shadow-2xl relative overflow-hidden">
                        {/* Compact Header for Collapsible Stats */}
                        <button
                            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                            className="w-full text-left p-3 md:p-4 flex items-center justify-between group/stats relative z-20"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-white/5 flex items-center justify-center">
                                    <AssetIcon symbol={pool.symbol} size={16} className="opacity-80" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-muted-foreground/50 font-black tracking-tighter">Your Position</span>
                                    <span className="text-sm font-black font-mono tracking-tight text-white">
                                        {formatSmallNumber(depositedAmount)} {pool.symbol}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex flex-col text-right">
                                    <span className="text-[9px] uppercase text-muted-foreground/30 font-black tracking-widest">Yield APY</span>
                                    <span className="text-blue-400 font-black font-mono text-xs">+{pool.apy.toFixed(2)}%</span>
                                </div>
                                <motion.div
                                    animate={{ rotate: isStatsExpanded ? 180 : 0 }}
                                    className="p-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground group-hover/stats:text-white transition-colors"
                                >
                                    <ArrowUpDown size={14} />
                                </motion.div>
                            </div>
                        </button>

                        <AnimatePresence>
                            {isStatsExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-t border-white/5 bg-white/[0.01]"
                                >
                                    <div className="p-3 md:p-5 pt-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[9px] md:text-[10px] uppercase text-muted-foreground/30 font-black tracking-tighter mb-1">Total Value (USD)</div>
                                                <div className="text-lg font-black font-mono tracking-tighter text-white">
                                                    {formatMoney(depositedAmountUSD)}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end justify-center">
                                                <div className="text-[9px] md:text-[10px] uppercase text-muted-foreground/30 font-black tracking-tighter mb-1.5">Health</div>
                                                <div className={cn("px-2 py-0.5 rounded-full border text-[10px] md:text-xs font-black uppercase italic",
                                                    activeHealth.healthFactor > 1.5
                                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                                                        : activeHealth.healthFactor > 1.1
                                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                                            : "bg-red-500/10 border-red-500/20 text-red-400"
                                                )}>
                                                    {activeHealth.healthFactor > 1.5 ? "SAFE" : activeHealth.healthFactor > 1.1 ? "WATCH" : "RISK"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase text-muted-foreground/30 font-black tracking-widest mb-0.5">Market Size</span>
                                                <span className="text-white font-black text-sm tracking-tight">{formatMoney(pool.tvlUsd)}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[9px] uppercase text-muted-foreground/30 font-black tracking-widest mb-0.5">Protocol</span>
                                                <span className="text-white/60 font-black text-[10px] uppercase italic tracking-tighter">{protocolDisplay}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="px-4 md:px-6 mb-4">
                    <div className="bg-[#121216] rounded-xl p-1 flex relative">
                        <motion.div className="absolute top-1 bottom-1 bg-[#1a1a20] rounded-lg shadow-sm" initial={false} animate={{ left: activeTab === 'deposit' ? '4px' : '50%', width: 'calc(50% - 4px)' }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                        <button onClick={() => { setActiveTab('deposit'); setAmount(''); resetWrite(); setStep('idle'); }} className={`flex-1 relative z-10 py-1.5 md:py-2 text-sm font-bold transition-colors ${activeTab === 'deposit' ? 'text-white' : 'text-muted-foreground hover:text-white/70'}`}>Deposit</button>
                        <button onClick={() => { setActiveTab('withdraw'); setAmount(''); resetWrite(); setStep('idle'); }} className={`flex-1 relative z-10 py-1.5 md:py-2 text-sm font-bold transition-colors ${activeTab === 'withdraw' ? 'text-white' : 'text-muted-foreground hover:text-white/70'}`}>Withdraw</button>
                    </div>
                </div>

                <div className="px-4 md:px-6 pb-5 text-white">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5 md:p-5 mb-4 shadow-inner relative overflow-hidden group">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] md:text-xs uppercase text-muted-foreground/60 font-black tracking-widest italic">{activeTab === 'deposit' ? 'Supply' : 'Withdraw'}</span>
                            <div className="flex gap-1.5">
                                {activeTab === 'withdraw' && (
                                    <button onClick={() => setAmount(toPlainString(maxSafe))} className="text-[9px] md:text-[10px] text-blue-400 font-black italic border border-blue-400/20 px-2 py-1 rounded-md hover:bg-blue-400/10 transition-colors uppercase tracking-tighter bg-blue-400/5">Safe Max</button>
                                )}
                                <button className="text-[9px] md:text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-all font-black uppercase text-muted-foreground/60 hover:text-white border border-white/10" onClick={setHalf}>Half</button>
                                <button className="text-[9px] md:text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-all font-black uppercase text-muted-foreground/60 hover:text-white border border-white/10" onClick={setMax}>Max</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 transition-transform group-focus-within:scale-95 duration-500">
                                <AssetIcon symbol={pool.symbol} className="w-5 h-5 md:w-6 md:h-6" />
                                <span className="font-black text-xs md:text-sm">{pool.symbol}</span>
                            </div>
                            <input
                                type="number"
                                placeholder="0.00"
                                className="bg-transparent text-right text-3xl md:text-4xl font-black font-mono tracking-tighter w-full outline-none placeholder:text-white/5 text-white"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] md:text-xs mt-4 pt-3 border-t border-white/[0.03]">
                            <div className="text-muted-foreground/40 font-bold uppercase italic">
                                {activeTab === 'deposit' ? 'Balance' : 'Available'}
                                <span className="text-white/60 font-black ml-1.5 not-italic">{formatSmallNumber(activeTab === 'deposit' ? walletBalance : maxWithdrawableAvailable)}</span>
                            </div>
                            <div className="text-muted-foreground/30 font-black italic">â‰ˆ {formatMoney(amountNum * tokenPrice)}</div>
                        </div>
                    </div>

                    {activeTab === 'withdraw' && isWithdrawBlocked && (
                        <div className="flex items-start gap-2 p-2 md:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-lg">
                            <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-[10px] md:text-[11px] text-amber-100 font-medium leading-relaxed">
                                Safe withdrawal limit reached. Repay debt first or use a smaller withdrawal amount.
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 md:p-4 space-y-2 md:space-y-3 mb-4 mx-4 md:mx-6">
                    <div className="flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        <span>{activeTab === 'deposit' ? 'Asset Quality & Impact' : 'Transaction Impact'}</span>
                    </div>
                    <div className="flex justify-between items-center w-full">
                        <span className="text-[10px] md:text-xs text-muted-foreground font-medium">{activeTab === 'deposit' ? 'Collateral Buffer' : 'Health Factor'}</span>
                        {activeTab === 'deposit' ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs md:text-sm font-bold text-[#3B82F6]">{((pool.ltv || 0) * 100).toFixed(0)}% LTV</span>
                                {(parseFloat(amount) || 0) > 0 && (<><ArrowRight className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground/30" /><span className="text-[10px] md:text-xs font-bold text-white/60">HF: {newHF > 5 ? '> 5.0' : newHF.toFixed(2)}</span></>)}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2"><span className="text-[10px] md:text-xs font-bold text-white/40">{(activeHealth.healthFactor || 10) > 5 ? '5.0' : activeHealth.healthFactor.toFixed(2)}</span><ArrowRight className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground/30" /><span className={cn("text-xs md:text-sm font-bold", newHF < 1.1 ? "text-red-400" : newHF < 1.5 ? "text-amber-400" : "text-[#3B82F6]")}>{newHF > 5 ? '> 5.0' : (newHF || 0).toFixed(2)}</span></div>
                        )}
                    </div>
                    {((activeTab === 'withdraw' && withdrawUSD > 0) || (activeTab === 'deposit' && (parseFloat(amount) || 0) > 0)) && (
                        <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden"><motion.div className={cn("h-full bg-gradient-to-r", activeTab === 'deposit' ? "from-blue-600 to-[#3B82F6]" : (newHF < 1.1 ? "from-red-500 to-orange-500" : "from-[#3B82F6] to-blue-400"))} initial={{ width: 0 }} animate={{ width: activeTab === 'deposit' ? '100%' : `${Math.min(100, (1 / (newHF || 1)) * 100)}%` }} transition={{ duration: 0.5 }} /></div>
                    )}
                    <div className="flex justify-between w-full text-[10px] md:text-xs items-center pt-1 border-t border-white/5"><span className="text-muted-foreground">Earning APY</span><span className="text-blue-400 font-mono font-bold">{pool.apy.toFixed(2)}%</span></div>
                </div>

                {isRisky && activeTab === 'withdraw' && (
                    <div className="p-2 md:p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2 md:gap-3 items-start mb-4 mx-4 md:mx-6"><ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400 mt-0.5 flex-shrink-0" /><p className="text-[10px] md:text-[11px] text-red-200">Warning: This withdrawal will put your account at risk of liquidation. Repay some debt or leave more collateral to stay safe.</p></div>
                )}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 md:p-6 pb-5 md:pb-6 border-t border-white/5 bg-[#09090b]/90 backdrop-blur-md shrink-0">
                <Button
                    onClick={handleAction}
                    disabled={isButtonDisabled}
                    className={`w-full h-14 md:h-16 text-xl md:text-2xl font-black rounded-2xl md:rounded-3xl transition-all relative overflow-hidden group/btn ${step === 'success'
                        ? 'bg-blue-500 hover:bg-blue-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                        : activeTab === 'deposit'
                            ? 'bg-blue-500 hover:bg-blue-400 text-black shadow-[0_10px_40px_rgba(16,185,129,0.2)]'
                            : 'bg-white hover:bg-gray-200 text-black shadow-[0_10px_40px_rgba(255,255,255,0.1)]'
                        }`}
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                    <AnimatePresence mode="wait">
                        {step === 'idle' && (
                            <motion.span
                                key="idle"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className="uppercase italic tracking-tighter"
                            >
                                {!isConnected ? 'Connect Wallet' : activeTab === 'deposit' ? 'Confirm Supply' : 'Confirm Withdraw'}
                            </motion.span>
                        )}
                        {step === 'approving' && (<motion.div key="approving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3"><Loader2 className="w-6 h-6 animate-spin" /><span className="uppercase italic">Permissioning...</span></motion.div>)}
                        {step === 'mining' && (<motion.div key="mining" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3"><Loader2 className="w-6 h-6 animate-spin" /><span className="uppercase italic">Broadcasting...</span></motion.div>)}
                        {step === 'success' && (<motion.div key="success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 text-white uppercase italic"><div className="bg-white text-blue-500 rounded-full p-1"><Check className="w-5 h-5 stroke-[4]" /></div><span>Complete</span></motion.div>)}
                    </AnimatePresence>
                </Button>
            </div>
        </div>
    );
}

export function EarnModal({ isOpen, onClose, pool }: EarnModalProps) {
    if (!isOpen) return null;
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-[420px] max-h-[90vh] overflow-y-auto bg-[#09090b] border-white/10 text-white p-0 gap-0 rounded-3xl scrollbar-hide">
                <EarnModalContent onClose={onClose} pool={pool} isEmbedded={false} />
            </DialogContent>
        </Dialog>
    );
}

