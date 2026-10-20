import type { SignalAddress, SignalSessionRecord } from '../../signal/types';
import type { WaSessionStore as WaSessionStoreContract } from '../contracts/session.store';
export interface WaSessionMemoryStoreOptions {
    readonly maxSessions?: number;
}
export declare class WaSessionMemoryStore implements WaSessionStoreContract {
    protected readonly signalSessions: Map<string, SignalSessionRecord>;
    private readonly maxSessions;
    constructor(options?: WaSessionMemoryStoreOptions);
    hasSession(address: SignalAddress): Promise<boolean>;
    hasSessions(addresses: readonly SignalAddress[]): Promise<readonly boolean[]>;
    getSession(address: SignalAddress): Promise<SignalSessionRecord | null>;
    getSessionsBatch(addresses: readonly SignalAddress[]): Promise<readonly (SignalSessionRecord | null)[]>;
    setSession(address: SignalAddress, session: SignalSessionRecord): Promise<void>;
    setSessionsBatch(entries: readonly {
        readonly address: SignalAddress;
        readonly session: SignalSessionRecord;
    }[]): Promise<void>;
    deleteSession(address: SignalAddress): Promise<void>;
    clear(): Promise<void>;
    /** Runs with the key of every read hit and write. No-op unless a subclass tracks access. */
    protected onEntryAccess(key: string): void;
    /** Runs with the key of every deleted or cap-evicted entry. */
    protected onEntryRemove(key: string): void;
    protected onEntriesClear(): void;
    private readonly onEvict;
}
