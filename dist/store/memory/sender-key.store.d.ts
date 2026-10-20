import type { SenderKeyDistributionRecord, SenderKeyRecord, SignalAddress } from '../../signal/types';
import type { WaSenderKeyStore as WaSenderKeyStoreContract } from '../contracts/sender-key.store';
export interface WaSenderKeyMemoryStoreOptions {
    readonly maxSenderKeys?: number;
    readonly maxSenderDistributions?: number;
}
export declare class SenderKeyMemoryStore implements WaSenderKeyStoreContract {
    protected readonly senderKeys: Map<string, SenderKeyRecord>;
    protected readonly senderDistributions: Map<string, SenderKeyDistributionRecord>;
    private readonly maxSenderKeys;
    private readonly maxSenderDistributions;
    constructor(options?: WaSenderKeyMemoryStoreOptions);
    upsertSenderKey(record: SenderKeyRecord): Promise<void>;
    upsertSenderKeyDistribution(record: SenderKeyDistributionRecord): Promise<void>;
    upsertSenderKeyDistributions(records: readonly SenderKeyDistributionRecord[]): Promise<void>;
    getGroupSenderKeyList(groupId: string): Promise<{
        readonly skList: readonly SenderKeyRecord[];
        readonly skDistribList: readonly SenderKeyDistributionRecord[];
    }>;
    getDeviceSenderKey(groupId: string, sender: SignalAddress): Promise<SenderKeyRecord | null>;
    getDeviceSenderKeyDistributions(groupId: string, senders: readonly SignalAddress[]): Promise<readonly (SenderKeyDistributionRecord | null)[]>;
    deleteDeviceSenderKey(target: SignalAddress, groupId?: string): Promise<number>;
    markForgetSenderKey(groupId: string, participants: readonly SignalAddress[]): Promise<number>;
    clear(): Promise<void>;
    /**
     * Runs with the map and key of every point-read hit and write (the group
     * scan does not count). No-op unless a subclass tracks access.
     */
    protected onEntryAccess(entries: Map<string, unknown>, key: string): void;
    /** Runs with the map and key of every deleted or cap-evicted entry. */
    protected onEntryRemove(entries: Map<string, unknown>, key: string): void;
    protected onEntriesClear(): void;
    private readonly onSenderKeyEvict;
    private readonly onDistributionEvict;
    private deleteMatching;
    private makeKey;
}
