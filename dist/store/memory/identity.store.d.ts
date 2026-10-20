import type { SignalAddress } from '../../signal/types';
import type { WaIdentityStore as WaIdentityStoreContract } from '../contracts/identity.store';
export interface WaIdentityMemoryStoreOptions {
    readonly maxRemoteIdentities?: number;
}
export declare class WaIdentityMemoryStore implements WaIdentityStoreContract {
    protected readonly remoteIdentities: Map<string, Uint8Array>;
    private readonly maxRemoteIdentities;
    constructor(options?: WaIdentityMemoryStoreOptions);
    getRemoteIdentity(address: SignalAddress): Promise<Uint8Array | null>;
    getRemoteIdentities(addresses: readonly SignalAddress[]): Promise<readonly (Uint8Array | null)[]>;
    setRemoteIdentity(address: SignalAddress, identityKey: Uint8Array): Promise<void>;
    setRemoteIdentities(entries: readonly {
        readonly address: SignalAddress;
        readonly identityKey: Uint8Array;
    }[]): Promise<void>;
    clear(): Promise<void>;
    /** Runs with the key of every read hit and write. No-op unless a subclass tracks access. */
    protected onEntryAccess(key: string): void;
    /** Runs with the key of every cap-evicted entry. */
    protected onEntryRemove(key: string): void;
    protected onEntriesClear(): void;
    private readonly onEvict;
}
