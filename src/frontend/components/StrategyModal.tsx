'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAccount, useChainId, useWriteContract, useReadContract, usePublicClient, useBalance } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { AssetIcon } from "@/components/ui/asset-icon";
import { useYields } from "@/hooks/useYields";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import {
    ArrowRight,
    Loader2,
    Layers,
    X,
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import {
    getUnderlyingAddress,
    ERC20_ABI,
    AAVE_POOL,
    RADIANT_LENDING_POOL,
} from '@/lib/pool-config';
import { formatUnits, parseUnits } from 'viem';
import {
    LOOP_VAULT_ADDRESS,
    LOOP_VAULT_ABI,
} from '@/lib/pool-config';
import { isArbitrumFamily } from '@/lib/network';
import { getExplorerTxUrl, upsertActivityRecord, updateActivityStatus } from '@/lib/activity';


interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        protocol: 'aave-v3' | 'radiant-v2';
        supplyAsset: string;
        borrowAsset: string;
    };
}

export function StrategyModal({ isOpen, onClose, initialData }: StrategyModalProps) {
    const { address } = useAccount();
    const chainId = useChainId();
    const { toast } = useToast();
    const { openConnectModal } = useConnectModal();
    const { data: yields } = useYields();
    const { data: priceData } = useTokenPrices();
    const getPrice = priceData?.getPrice || (() => 0);
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;
    const extractErrorMessage = (err: unknown): string => {
        if (typeof err === 'string') return err;
        if (typeof err !== 'object' || !err) return '';
        const maybe = err as { shortMessage?: unknown; message?: unknown };
        if (typeof maybe.shortMessage === 'string') return maybe.shortMessage;
        if (typeof maybe.message === 'string') return maybe.message;
        return '';
    };

    // -- State --
    const [protocol, setProtocol] = useState<'aave-v3' | 'radiant-v2'>('aave-v3');
    const [tokenA, setTokenA] = useState('USDC'); // Supply
    const [tokenB, setTokenB] = useState('USDT'); // Borrow
    const [inputToken, setInputToken] = useState(initialData?.supplyAsset || 'USDT');
    const [amount, setAmount] = useState('1000');

    const [leverage, setLeverage] = useState(2.0);
    const [isExecuting, setIsExecuting] = useState(false);
    const [txStep, setTxStep] = useState<'idle' | 'approving' | 'executing'>('idle');

    // -- Contract Hooks --
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // Track balance/allowance based on inputToken
    const isPayingWithNative = inputToken === 'ETH';

    const assetAddress = useMemo(() => {
        if (isPayingWithNative) return getUnderlyingAddress(tokenA, protocol);
        return getUnderlyingAddress(inputToken, protocol) || getUnderlyingAddress(inputToken, 'aave-v3');
    }, [inputToken, isPayingWithNative, tokenA, protocol]);

    const { data: allowance } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && assetAddress && !isPayingWithNative ? [address, LOOP_VAULT_ADDRESS] : undefined,
        query: { enabled: !isPayingWithNative },
    });

    const { data: tokenBalanceData } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address && assetAddress && !isPayingWithNative ? [address] : undefined,
        query: { enabled: !isPayingWithNative },
    });

    const { data: tokenDecimals } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !isPayingWithNative },
    });

    // Native token balance
    const { data: nativeBalanceData } = useBalance({
        address: address,
        query: { enabled: isPayingWithNative },
    });

    const walletBalanceFormatted = useMemo(() => {
        if (isPayingWithNative) {
            if (!nativeBalanceData) return null;
            return nativeBalanceData.formatted;
        }
        if (!tokenBalanceData || !tokenDecimals) return null;
        return formatUnits(tokenBalanceData as bigint, tokenDecimals as number);
    }, [isPayingWithNative, nativeBalanceData, tokenBalanceData, tokenDecimals]);

    // Check for insufficient balance
    const isInsufficient = useMemo(() => {
        if (!amount) return false;
        // If walletBalanceFormatted is null (loading/error), we assume false to avoid flashing red.
        // OR we could check if tokenBalanceData is defined?
        // Let's stick to safe string parsing.
        if (walletBalanceFormatted == null) return false;
        const balance = parseFloat(walletBalanceFormatted);
        const amt = parseFloat(amount);
        if (isNaN(balance) || isNaN(amt)) return false;
        return amt > balance;
    }, [walletBalanceFormatted, amount]);

    const decimals = isPayingWithNative ? 18 : (tokenDecimals as number) || 18;

    // Initialize from props
    useEffect(() => {
        if (isOpen && initialData) {
            setProtocol(initialData.protocol);
            setTokenA(initialData.supplyAsset);
            setTokenB(initialData.borrowAsset);
            setInputToken(initialData.supplyAsset);
            // Reset state
            setAmount('');
            setAmount('1000');
        }
    }, [isOpen, initialData]);

    // -- Wallet Balance Hooks --


    // -- Effects for Stepper --

    // -- Calculated Data --
    const protocolYields = useMemo(() => {
        if (!yields) return [];
        return yields.filter(y => y.project.toLowerCase().includes(protocol));
    }, [yields, protocol]);

    const poolA = protocolYields.find(y => y.symbol === tokenA);
    const poolB = protocolYields.find(y => y.symbol === tokenB);

    const ltv = poolA?.ltv || 0.8;
    const maxLeverage = Math.min(3, 1 / (1 - ltv));

    const priceA = getPrice(tokenA);
    const priceB = getPrice(tokenB);
    const priceInput = getPrice(inputToken) || priceA;

    const tokenAmount = parseFloat(amount) || 0;
    const principalUSD = tokenAmount * priceInput; // USD value of what user sends
    const totalExposureUSD = principalUSD * leverage;
    const totalDebtUSD = totalExposureUSD - principalUSD;

    const healthFactor = totalDebtUSD > 0 ? (totalExposureUSD * ltv) / totalDebtUSD : 999;
    const netApy = principalUSD > 0
        ? (((poolA?.apy || 0) * totalExposureUSD) - ((poolB?.apyBaseBorrow || 0) * totalDebtUSD)) / principalUSD
        : 0;

    // -- Projections --
    const projections = useMemo(() => {
        if (!principalUSD || principalUSD <= 0) return null;
        const rate = netApy / 100;

        const calculateReturn = (years: number) => {
            return principalUSD * Math.pow(1 + rate, years) - principalUSD;
        };

        return [
            { label: '1 Month', value: calculateReturn(1 / 12), time: '1m' },
            { label: '3 Months', value: calculateReturn(3 / 12), time: '3m' },
            { label: '6 Months', value: calculateReturn(0.5), time: '6m' },
            { label: '1 Year', value: calculateReturn(1), time: '1y' },
            { label: '3 Years', value: calculateReturn(3), time: '3y' }
        ];
    }, [principalUSD, netApy]);
    // -- Execution Flow --
    const handleExecute = async () => {
        if (!address) {
            openConnectModal?.();
            return;
        }

        if (leverage < 1.5) {
            toast({ title: "Invalid Leverage", description: "Minimum leverage is 1.5x.", variant: "destructive" });
            return;
        }
        if (!tokenAmount || tokenAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Enter an amount greater than 0.", variant: "destructive" });
            return;
        }
        if (walletBalanceFormatted && tokenAmount > parseFloat(walletBalanceFormatted)) {
            toast({ title: "Insufficient Balance", description: `You only have ${walletBalanceFormatted} ${inputToken} in your wallet.`, variant: "destructive" });
            return;
        }

        // --- Resolve token addresses ---
        const supplyAssetAddr = getUnderlyingAddress(tokenA, protocol) as `0x${string}`;
        const borrowAssetAddr = getUnderlyingAddress(tokenB, protocol) as `0x${string}`;

        // Input token — what the user actually sends (could differ from supplyAsset)
        // If inputToken === tokenA (supply asset), no extra swap. Otherwise contract swaps.
        // For native ETH, use address(0).
        const inputTokenAddr = (inputToken === 'ETH')
            ? ZERO_ADDRESS
            : (getUnderlyingAddress(inputToken, protocol) || supplyAssetAddr) as `0x${string}`;
        const isNativeToken = inputToken === 'ETH';

        if (!supplyAssetAddr || !borrowAssetAddr) {
            toast({ title: "Error", description: "Could not resolve token addresses.", variant: "destructive" });
            return;
        }
        if (LOOP_VAULT_ADDRESS === ZERO_ADDRESS) {
            toast({ title: "Vault Not Configured", description: "Set NEXT_PUBLIC_LOOP_VAULT_ADDRESS first.", variant: "destructive" });
            return;
        }
        if (!publicClient) {
            toast({ title: "RPC Not Ready", description: "Public client unavailable. Retry in a moment.", variant: "destructive" });
            return;
        }
        if (isArbitrumFamily && inputTokenAddr.toLowerCase() !== supplyAssetAddr.toLowerCase()) {
            toast({
                title: "Unsupported Input Pair",
                description: "Arbitrum vault currently requires input token to match the supply asset.",
                variant: "destructive"
            });
            return;
        }

        const readTokenDecimals = async (token: `0x${string}`, fallback = 18) => {
            try {
                const result = await publicClient.readContract({
                    address: token,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                }) as number;
                return Number(result);
            } catch {
                return fallback;
            }
        };
        const inputDecimals = isNativeToken
            ? 18
            : await readTokenDecimals(inputTokenAddr, decimals || 18);
        const supplyDecimals = await readTokenDecimals(supplyAssetAddr, inputDecimals);
        const borrowDecimals = await readTokenDecimals(borrowAssetAddr, 18);
        let rawAmount: bigint;
        try {
            rawAmount = parseUnits(amount, inputDecimals);
        } catch {
            toast({ title: "Invalid Amount Format", description: "Amount precision is too high for this token.", variant: "destructive" });
            return;
        }

        // --- Legacy route hint (unused on Arbitrum path) ---
        const legacyRouteHint: `0x${string}` = ZERO_ADDRESS;
        if (!isArbitrumFamily) {
            toast({ title: "Unsupported Network", description: "This build is Arbitrum-only.", variant: "destructive" });
            return;
        }

        // --- Calculate amounts in supplyAsset terms ---
        // When paying with native token (or any non-supply token), the contract will swap
        // inputToken → supplyAsset. We estimate the supply equivalent based on USD prices.
        const inputValueUSD = tokenAmount * priceInput;
        const supplyEquivalent = priceA > 0 ? inputValueUSD / priceA : tokenAmount;

        // Flash amount in supply asset terms (not input token!)
        const flashAmountFloat = isArbitrumFamily ? 0 : (supplyEquivalent * (leverage - 1));
        const flashPrecision = Math.min(8, Math.max(0, supplyDecimals));
        let rawFlashAmount: bigint;
        try {
            rawFlashAmount = parseUnits(flashAmountFloat.toFixed(flashPrecision), supplyDecimals);
        } catch {
            toast({ title: "Amount Conversion Error", description: "Could not convert flash amount for token decimals.", variant: "destructive" });
            return;
        }

        // --- Calculate borrow amount ---
        const totalSupplyUSD = supplyEquivalent * priceA * leverage;
        const safetyFactor = 0.92;
        const borrowableUSD = totalSupplyUSD * ltv * safetyFactor;
        const targetDebtUSD = Math.max(0, totalSupplyUSD - principalUSD);
        const flashRepayUSD = flashAmountFloat * priceA * 1.0025;
        const neededBorrowUSD = isArbitrumFamily
            ? Math.min(targetDebtUSD, borrowableUSD)
            : Math.min(flashRepayUSD / 0.9975, borrowableUSD);
        const borrowAmountFloat = neededBorrowUSD / priceB;
        if (!isFinite(borrowAmountFloat) || borrowAmountFloat <= 0) {
            toast({ title: "Invalid Borrow Size", description: "Borrow amount calculated to zero. Adjust leverage or amount.", variant: "destructive" });
            return;
        }
        const borrowPrecision = Math.min(8, Math.max(0, borrowDecimals));
        let rawBorrowAmount: bigint;
        try {
            rawBorrowAmount = parseUnits(borrowAmountFloat.toFixed(borrowPrecision), borrowDecimals);
        } catch {
            toast({ title: "Amount Conversion Error", description: "Could not convert borrow amount for token decimals.", variant: "destructive" });
            return;
        }
        const totalFeesUSD = isArbitrumFamily ? 0 : (flashAmountFloat * priceA * 0.005);

        // Credit delegation ABI for Aave V2/V3 variable debt tokens
        const DELEGATION_ABI = [
            { "inputs": [{ "name": "delegatee", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approveDelegation", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
            { "inputs": [{ "name": "fromUser", "type": "address" }, { "name": "toUser", "type": "address" }], "name": "borrowAllowance", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
        ] as const;

        try {
            setIsExecuting(true);

            // Step 1: Approve input token to vault (skip for native token)
            if (!isNativeToken) {
                if (!allowance || (allowance as bigint) < rawAmount) {
                    setTxStep('approving');
                    const approveAddr = inputTokenAddr !== '0x0000000000000000000000000000000000000000'
                        ? inputTokenAddr : supplyAssetAddr;
                    await writeContractAsync({
                        address: approveAddr,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [LOOP_VAULT_ADDRESS, rawAmount],
                    });
                    toast({ title: "Approved!", description: "Input token approved for the vault." });
                }
            }

            // Step 2: Credit delegation for Aave / Radiant (borrow on behalf of user)
            // The user approves the vault to take debt on their behalf
            if (protocol === 'aave-v3' || protocol === 'radiant-v2') {
                setTxStep('approving');

                // Get the variable debt token address from the lending pool
                    const poolAddr = protocol === 'aave-v3' ? AAVE_POOL : RADIANT_LENDING_POOL;
                    if (poolAddr === ZERO_ADDRESS) {
                        toast({
                            title: "Protocol Not Configured",
                            description: `Set ${protocol === 'aave-v3' ? 'NEXT_PUBLIC_AAVE_POOL_ADDRESS' : 'NEXT_PUBLIC_RADIANT_POOL_ADDRESS'} first.`,
                            variant: "destructive"
                        });
                        return;
                    }

                const RESERVE_DATA_ABI = [{ "inputs": [{ "name": "asset", "type": "address" }], "name": "getReserveData", "outputs": [{ "components": [{ "name": "configuration", "type": "uint256" }, { "name": "liquidityIndex", "type": "uint128" }, { "name": "variableBorrowIndex", "type": "uint128" }, { "name": "currentLiquidityRate", "type": "uint128" }, { "name": "currentVariableBorrowRate", "type": "uint128" }, { "name": "currentStableBorrowRate", "type": "uint128" }, { "name": "lastUpdateTimestamp", "type": "uint40" }, { "name": "aTokenAddress", "type": "address" }, { "name": "stableDebtTokenAddress", "type": "address" }, { "name": "variableDebtTokenAddress", "type": "address" }, { "name": "interestRateStrategyAddress", "type": "address" }, { "name": "id", "type": "uint8" }], "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }] as const;

                try {
                    const reserveData = await publicClient.readContract({
                        address: poolAddr,
                        abi: RESERVE_DATA_ABI,
                        functionName: 'getReserveData',
                        args: [borrowAssetAddr],
                    }) as { variableDebtTokenAddress: `0x${string}` };

                    const variableDebtToken = reserveData.variableDebtTokenAddress as `0x${string}`;

                    // Check current delegation allowance
                    const currentAllowance = await publicClient.readContract({
                        address: variableDebtToken,
                        abi: DELEGATION_ABI,
                        functionName: 'borrowAllowance',
                        args: [address, LOOP_VAULT_ADDRESS],
                    }) as bigint;

                    if (currentAllowance < rawBorrowAmount) {
                        toast({ title: "Credit Delegation", description: "Approving vault to borrow on your behalf..." });
                        await writeContractAsync({
                            address: variableDebtToken,
                            abi: DELEGATION_ABI,
                            functionName: 'approveDelegation',
                            args: [LOOP_VAULT_ADDRESS, rawBorrowAmount * BigInt(2)], // 2x buffer
                        });
                        toast({ title: "Delegated!", description: "Credit delegation approved." });
                    }
                } catch (e) {
                    console.warn("Credit delegation check failed, proceeding anyway:", e);
                }
            }

            setTxStep('executing');
            const txValue = isPayingWithNative ? rawAmount : BigInt(0);
            let executionHash: `0x${string}`;

            if (protocol === 'aave-v3') {
                // Contract wrapper name kept for backward compatibility.
                executionHash = await writeContractAsync({
                    address: LOOP_VAULT_ADDRESS,
                    abi: LOOP_VAULT_ABI,
                    functionName: 'leverageAave',
                    args: [inputTokenAddr, supplyAssetAddr, borrowAssetAddr, rawAmount, rawFlashAmount, rawBorrowAmount, legacyRouteHint],
                    value: txValue,
                });
            } else if (protocol === 'radiant-v2') {
                executionHash = await writeContractAsync({
                    address: LOOP_VAULT_ADDRESS,
                    abi: LOOP_VAULT_ABI,
                    functionName: 'leverageRadiant',
                    args: [inputTokenAddr, supplyAssetAddr, borrowAssetAddr, rawAmount, rawFlashAmount, rawBorrowAmount, legacyRouteHint],
                    value: txValue,
                });
            } else {
                return;
            }

            if (address) {
                upsertActivityRecord(address, chainId, {
                    hash: executionHash,
                    protocol,
                    action: 'leverage',
                    asset: `${tokenA}/${tokenB}`,
                    amount: tokenAmount,
                    amountUsd: principalUSD,
                    status: 'pending',
                    explorerUrl: getExplorerTxUrl(chainId, executionHash),
                    summary: `${tokenA}/${tokenB} loop ${leverage.toFixed(2)}x`,
                });

                publicClient.waitForTransactionReceipt({ hash: executionHash })
                    .then(() => {
                        updateActivityStatus(address, chainId, executionHash, 'confirmed');
                    })
                    .catch(() => {
                        updateActivityStatus(address, chainId, executionHash, 'failed');
                    });
            }

            const protocolLabel = protocol === 'aave-v3' ? 'Aave V3' : 'Radiant';
            toast({
                title: "Strategy Submitted",
                description: `${tokenA}/${tokenB} loop at ${leverage.toFixed(1)}x on ${protocolLabel}. Flash: $${(flashAmountFloat * priceA).toFixed(2)}, Fees: ~$${totalFeesUSD.toFixed(2)}`,
            });
            onClose();

        } catch (err: unknown) {
            console.error("Execution error:", err);
            const msg = extractErrorMessage(err);
            let friendlyMsg = 'Transaction could not be completed. Try changing the amount and leverage position to get filled.';
            if (msg.includes('User rejected') || msg.includes('User denied')) {
                friendlyMsg = 'You cancelled the transaction. Try changing the amount and leverage position to get filled.';
            } else if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
                friendlyMsg = 'Insufficient balance for this transaction.';
            } else if (msg.includes('reverted')) {
                friendlyMsg = 'Transaction reverted on-chain. Try changing the amount and leverage position to get filled.';
            }
            toast({
                title: "Execution Failed",
                description: friendlyMsg,
                variant: "destructive"
            });
        } finally {
            setIsExecuting(false);
            setTxStep('idle');
        }
    };

    const truncateAmount = (val: string | null) => {
        if (!val) return '0';
        const [int, dec] = val.split('.');
        if (dec && dec.length > 8) {
            return `${int}.${dec.substring(0, 8)}`;
        }
        return val;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[1000px] h-auto max-h-[85vh] sm:h-auto overflow-y-auto bg-[#0f0f12] border-white/10 text-white p-0 gap-0 rounded-2xl sm:rounded-3xl">
                    <div className="sticky top-0 z-20 flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-[#0f0f12]/80 backdrop-blur-md">
                        <div>
                            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="flex items-center">
                                    <div className="relative z-10">
                                        <AssetIcon symbol={tokenA} size={28} className="border-2 border-[#0f0f12] rounded-full bg-[#0f0f12]" />
                                    </div>
                                    <div className="relative -ml-3 z-0">
                                        <AssetIcon symbol={tokenB} size={28} className="border-2 border-[#0f0f12] rounded-full bg-[#0f0f12] opacity-80" />
                                    </div>
                                </div>
                                {tokenA} / {tokenB} Strategy
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-1">
                                Execute a multi-step loop on {protocol === 'aave-v3' ? 'Aave V3' : 'Radiant'}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
                        {/* 1. Selection Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                <span className="flex items-center gap-2 text-[#CEFF00] mb-2 font-bold text-sm uppercase tracking-widest">
                                    Your Deposit
                                </span>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1 mb-1 block">Amount</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder={`e.g. 10`}
                                                className={`w-full h-12 px-4 rounded-xl border ${isInsufficient ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#CEFF00]/50'} bg-white/5 text-white font-bold text-lg focus:outline-none focus:ring-1 ${isInsufficient ? 'focus:ring-red-500/30' : 'focus:ring-[#CEFF00]/30'} transition-colors placeholder:text-white/20`}
                                            />
                                        </div>
                                        <div className="w-[120px] shrink-0">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1 mb-1 block">Pay With</label>
                                            <div className="w-full h-12 px-3 rounded-xl border border-white/10 bg-white/5 text-white font-bold text-sm flex items-center justify-center gap-2">
                                                <AssetIcon symbol={inputToken} size={20} />
                                                <span>{inputToken}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {principalUSD > 0 && (
                                        <div className="flex justify-between items-start px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">USD Value:</span>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-[10px] font-bold ${isInsufficient ? 'text-red-500' : 'text-white'}`}>
                                                    ${principalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                                {isInsufficient && (
                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider animate-pulse">
                                                        Insufficient {inputToken}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {address && (
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Balance:</span>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        const bal = parseFloat(walletBalanceFormatted || '0');
                                                        setAmount((bal * 0.5).toFixed(6));
                                                    }}
                                                    className="text-[10px] font-bold text-muted-foreground hover:text-[#CEFF00] hover:underline cursor-pointer transition-colors"
                                                >
                                                    50%
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setAmount(truncateAmount(walletBalanceFormatted || '0'));
                                                    }}
                                                    className="text-[10px] font-bold text-[#CEFF00] hover:underline cursor-pointer"
                                                >
                                                    {truncateAmount(walletBalanceFormatted || '0')} {inputToken} (Max)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                <span className="flex items-center gap-2 text-[#CEFF00] mb-2 font-bold text-sm uppercase tracking-widest">
                                    Strategy Config
                                </span>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-white text-sm">Target Leverage</span>
                                        <span className="text-xl font-black text-[#CEFF00] font-mono">{leverage.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.5"
                                        max={maxLeverage.toFixed(2)}
                                        step="0.1"
                                        value={leverage}
                                        onChange={(e) => setLeverage(parseFloat(e.target.value))}
                                        className="w-full accent-[#CEFF00] h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                        <span>Safe</span>
                                        <span className="text-red-500/80">High Risk</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Net APY</span>
                                <span className="text-lg font-bold text-[#CEFF00]">+{netApy.toFixed(2)}%</span>
                                <div className="flex gap-2 text-[9px] text-muted-foreground mt-1">
                                    <span className="text-emerald-400">Supply: +{(poolA?.apy || 0).toFixed(2)}%</span>
                                    <span className="text-white/20">|</span>
                                    <span className="text-red-400">Borrow: -{(poolB?.apyBaseBorrow || 0).toFixed(2)}%</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Health Factor</span>
                                <span className={`text-lg font-bold ${healthFactor > 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {healthFactor > 100 ? '>100' : healthFactor.toFixed(2)}
                                </span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Total Debt</span>
                                <span className="text-lg font-bold text-white">${totalDebtUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Exposure</span>
                                <span className="text-lg font-bold text-white">${totalExposureUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* 3. Beta Warning */}
                        <div className="bg-[#CEFF00]/10 border border-[#CEFF00]/20 rounded-xl p-4 flex gap-3">
                            <Layers className="w-5 h-5 text-[#CEFF00] shrink-0" />
                            <div className="space-y-1">
                                <h4 className="font-bold text-[#CEFF00] text-sm">Mainnet Execution Ready</h4>
                                <p className="text-xs text-muted-foreground">
                                    This strategy will be executed on-chain via our secure vault contract.
                                </p>
                            </div>
                        </div>

                        {/* Spacer for sticky footer */}
                        <div className="h-24"></div>
                    </div>

                    {/* Projections Table - Visible when Amount > 0 */}
                    <div className={`transition-all duration-500 overflow-hidden space-y-4 px-4 md:px-6 relative z-0 ${(parseFloat(amount) > 0) ? 'max-h-[1000px] opacity-100 mb-20' : 'max-h-0 opacity-0'}`}>
                        {projections && (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden mb-6">
                                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                    <h3 className="font-bold text-white text-sm">Projected Earnings</h3>
                                    <span className="text-xs text-muted-foreground">Based on current rates</span>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {projections.map((p) => (
                                        <div key={p.time} className="flex justify-between items-center p-4 hover:bg-white/[0.02] transition-colors">
                                            <span className="text-sm text-muted-foreground">{p.label}</span>
                                            <div className="text-right">
                                                <div className="font-bold text-[#CEFF00] font-mono">
                                                    +${p.value.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Total: ${(principalUSD + p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons - Sticky Footer */}
                    <div className="sticky bottom-0 left-0 w-full p-4 md:p-6 bg-[#0f0f12]/95 backdrop-blur-xl border-t border-white/10 z-30 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] flex flex-col gap-3">
                        {!address ? (
                            <Button
                                className="w-full h-12 bg-[#CEFF00] text-black border-none hover:bg-[#b8e600] font-bold"
                                onClick={() => openConnectModal?.()}
                            >
                                Connect Wallet to Execute
                            </Button>
                        ) : (
                            <>

                                <Button
                                    disabled={isExecuting || !principalUSD}
                                    className="w-full h-12 bg-[#CEFF00] text-black border-none hover:bg-[#b8e600] font-bold relative overflow-hidden group shadow-[0_0_20px_-5px_#CEFF00]"
                                    onClick={handleExecute}
                                >
                                    {isExecuting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>{txStep === 'approving' ? 'Approving Asset...' : 'Executing Loop...'}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span>Execute Strategy</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full h-10 text-muted-foreground hover:text-white hover:bg-white/5"
                                    onClick={onClose}
                                    disabled={isExecuting}
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                    </div>

                </DialogContent>
            </Dialog >


        </>
    );
}
