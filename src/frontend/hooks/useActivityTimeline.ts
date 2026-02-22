'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ActivityRecord, getActivityEventName, readActivityRecords } from '@/lib/activity';

export function useActivityTimeline() {
    const { address } = useAccount();
    const chainId = useChainId();
    const [records, setRecords] = useState<ActivityRecord[]>([]);

    const refresh = useCallback(() => {
        if (!address) {
            setRecords([]);
            return;
        }

        const next = readActivityRecords(address, chainId);
        setRecords(next);
    }, [address, chainId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const update = () => refresh();
        const customEvent = getActivityEventName();
        window.addEventListener(customEvent, update);
        window.addEventListener('storage', update);

        return () => {
            window.removeEventListener(customEvent, update);
            window.removeEventListener('storage', update);
        };
    }, [refresh]);

    return {
        records,
        refresh,
    };
}
