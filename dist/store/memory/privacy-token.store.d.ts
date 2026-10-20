import type { WaPrivacyTokenStore, WaStoredPrivacyTokenRecord } from '../contracts/privacy-token.store';
export declare class WaPrivacyTokenMemoryStore implements WaPrivacyTokenStore {
    protected readonly records: Map<string, WaStoredPrivacyTokenRecord>;
    private readonly maxEntries;
    constructor(maxEntries?: number);
    upsert(record: WaStoredPrivacyTokenRecord): Promise<void>;
    upsertBatch(records: readonly WaStoredPrivacyTokenRecord[]): Promise<void>;
    getByJid(jid: string): Promise<WaStoredPrivacyTokenRecord | null>;
    deleteByJid(jid: string): Promise<number>;
    clear(): Promise<void>;
    destroy(): Promise<void>;
    /** Runs with the jid of every read hit and write. No-op unless a subclass tracks access. */
    protected onEntryAccess(jid: string): void;
    /** Runs with the jid of every deleted or cap-evicted record. */
    protected onEntryRemove(jid: string): void;
    protected onEntriesClear(): void;
    private readonly onEvict;
    private mergeRecord;
}
