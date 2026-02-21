import { useReadContracts, useAccount } from 'wagmi';
import { useMemo } from 'react';
import { parseAbi } from 'viem';
import { AAVE_POOL, RADIANT_LENDING_POOL } from '@/lib/pool-config';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const AAVE_POOL_ABI = parseAbi([
    'function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
]);

export interface ProtocolHealth {
    healthFactor: number;
    isHealthy: boolean;
    status: 'safe' | 'warning' | 'danger' | 'inactive';
    hasPositions: boolean;
    borrowPowerUSD: number;
    debtUSD: number;
}

function toProtocolHealth(result?: [bigint, bigint, bigint, bigint, bigint, bigint]): ProtocolHealth {
    const defaultHealth: ProtocolHealth = {
        healthFactor: 0,
        isHealthy: true,
        status: 'inactive',
        hasPositions: false,
        borrowPowerUSD: 0,
        debtUSD: 0
    };

    if (!result) return defaultHealth;

    const totalCollateral = Number(result[0]) / 1e8;
    const totalDebt = Number(result[1]) / 1e8;
    const availableBorrows = Number(result[2]) / 1e8;
    const currentThreshold = Number(result[4]) / 10000;
    const hfRaw = Number(result[5]) / 1e18;
    const hasPositions = totalCollateral > 0.001 || totalDebt > 0.001;

    if (!hasPositions) return defaultHealth;

    const borrowPowerUSD = totalCollateral * currentThreshold;
    const status = hfRaw > 1.5 ? 'safe' : (hfRaw > 1.0 ? 'warning' : 'danger');

    return {
        healthFactor: hfRaw,
        isHealthy: hfRaw > 1.2,
        status,
        hasPositions,
        borrowPowerUSD: Math.max(borrowPowerUSD, totalDebt + availableBorrows),
        debtUSD: totalDebt
    };
}

export function useAggregatedHealth(targetAddress?: string) {
    const { address: connectedAddress } = useAccount();
    const address = targetAddress || connectedAddress;

    const hasAave = AAVE_POOL.toLowerCase() !== ZERO_ADDRESS;
    const hasRadiant = RADIANT_LENDING_POOL.toLowerCase() !== ZERO_ADDRESS;

    const contracts: any[] = [];
    let aaveIndex = -1;
    let radiantIndex = -1;

    if (hasAave) {
        aaveIndex = contracts.push({
            address: AAVE_POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'getUserAccountData',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;
    }

    if (hasRadiant) {
        radiantIndex = contracts.push({
            address: RADIANT_LENDING_POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'getUserAccountData',
            args: address ? [address as `0x${string}`] : undefined,
        }) - 1;
    }

    const { data, refetch } = useReadContracts({
        contracts,
        query: {
            enabled: !!address && contracts.length > 0,
            refetchInterval: 15000,
        }
    });

    return useMemo(() => {
        const defaultHealth: ProtocolHealth = {
            healthFactor: 0,
            isHealthy: true,
            status: 'inactive',
            hasPositions: false,
            borrowPowerUSD: 0,
            debtUSD: 0
        };

        if (!data || !address) {
            return {
                aave: defaultHealth,
                radiant: defaultHealth,
                overallScore: 10,
                totalBorrowPowerUSD: 0,
                totalDebtUSD: 0,
                isLoading: true
            };
        }

        const aave = (hasAave && aaveIndex >= 0 && data[aaveIndex]?.status === 'success')
            ? toProtocolHealth(data[aaveIndex].result as [bigint, bigint, bigint, bigint, bigint, bigint])
            : defaultHealth;

        const radiant = (hasRadiant && radiantIndex >= 0 && data[radiantIndex]?.status === 'success')
            ? toProtocolHealth(data[radiantIndex].result as [bigint, bigint, bigint, bigint, bigint, bigint])
            : defaultHealth;

        const activeProtocols = [aave, radiant].filter((protocol) => protocol.hasPositions);
        let overallScore = 10;
        if (activeProtocols.length > 0) {
            const avgHF = activeProtocols.reduce((sum, protocol) => sum + Math.min(2, protocol.healthFactor), 0) / activeProtocols.length;
            overallScore = Math.min(10, Math.max(0, avgHF * 5));
            overallScore = Math.round(overallScore * 10) / 10;
        }

        const totalBorrowPowerUSD = (aave.borrowPowerUSD || 0) + (radiant.borrowPowerUSD || 0);
        const totalDebtUSD = (aave.debtUSD || 0) + (radiant.debtUSD || 0);

        return {
            aave,
            radiant,
            overallScore,
            totalBorrowPowerUSD,
            totalDebtUSD,
            isLoading: false,
            refetch
        };
    }, [
        data,
        address,
        hasAave,
        hasRadiant,
        aaveIndex,
        radiantIndex,
        refetch
    ]);
}
