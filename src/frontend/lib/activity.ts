export type ActivityStatus = 'pending' | 'confirmed' | 'failed';

export type ActivityAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'leverage';

export interface ActivityRecord {
    id: string;
    walletAddress: string;
    chainId: number;
    hash?: `0x${string}`;
    protocol: string;
    action: ActivityAction;
    asset: string;
    amount?: number;
    amountUsd?: number;
    status: ActivityStatus;
    summary?: string;
    explorerUrl?: string;
    createdAt: number;
    updatedAt: number;
}

const MAX_ACTIVITY_RECORDS = 400;
const ACTIVITY_EVENT = 'arbiloop:activity-updated';

function isBrowser() {
    return typeof window !== 'undefined';
}

function getKey(walletAddress: string, chainId: number) {
    return `arbiloop.activity.${walletAddress.toLowerCase()}.${chainId}`;
}

function emitActivityChange() {
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
}

export function getActivityEventName() {
    return ACTIVITY_EVENT;
}

export function getExplorerTxUrl(chainId: number, hash: string) {
    if (chainId === 421614) return `https://sepolia.arbiscan.io/tx/${hash}`;
    return `https://arbiscan.io/tx/${hash}`;
}

export function readActivityRecords(walletAddress: string, chainId: number): ActivityRecord[] {
    if (!isBrowser()) return [];

    try {
        const raw = window.localStorage.getItem(getKey(walletAddress, chainId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ActivityRecord[];
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string')
            .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
        return [];
    }
}

function writeActivityRecords(walletAddress: string, chainId: number, records: ActivityRecord[]) {
    if (!isBrowser()) return;
    const trimmed = records
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_ACTIVITY_RECORDS);

    window.localStorage.setItem(getKey(walletAddress, chainId), JSON.stringify(trimmed));
    emitActivityChange();
}

export function upsertActivityRecord(
    walletAddress: string,
    chainId: number,
    nextRecord: Omit<ActivityRecord, 'id' | 'createdAt' | 'updatedAt' | 'walletAddress' | 'chainId'> & { id?: string }
) {
    const now = Date.now();
    const normalizedWallet = walletAddress.toLowerCase();
    const records = readActivityRecords(normalizedWallet, chainId);
    const incomingId = nextRecord.id || nextRecord.hash || `local-${now}`;

    const index = records.findIndex((record) => {
        if (nextRecord.hash && record.hash) {
            return record.hash.toLowerCase() === nextRecord.hash.toLowerCase();
        }
        return record.id === incomingId;
    });

    const current = index >= 0 ? records[index] : null;
    const merged: ActivityRecord = {
        id: current?.id || incomingId,
        walletAddress: normalizedWallet,
        chainId,
        hash: nextRecord.hash || current?.hash,
        protocol: nextRecord.protocol || current?.protocol || 'unknown',
        action: nextRecord.action || current?.action || 'deposit',
        asset: nextRecord.asset || current?.asset || 'UNKNOWN',
        amount: nextRecord.amount ?? current?.amount,
        amountUsd: nextRecord.amountUsd ?? current?.amountUsd,
        status: nextRecord.status || current?.status || 'pending',
        summary: nextRecord.summary ?? current?.summary,
        explorerUrl: nextRecord.explorerUrl || current?.explorerUrl,
        createdAt: current?.createdAt || now,
        updatedAt: now,
    };

    if (index >= 0) {
        records[index] = merged;
    } else {
        records.push(merged);
    }

    writeActivityRecords(normalizedWallet, chainId, records);
    return merged;
}

export function updateActivityStatus(
    walletAddress: string,
    chainId: number,
    hash: `0x${string}`,
    status: ActivityStatus
) {
    const records = readActivityRecords(walletAddress, chainId);
    const index = records.findIndex(
        (record) => record.hash?.toLowerCase() === hash.toLowerCase()
    );

    if (index < 0) return;
    records[index] = {
        ...records[index],
        status,
        updatedAt: Date.now(),
    };
    writeActivityRecords(walletAddress, chainId, records);
}
