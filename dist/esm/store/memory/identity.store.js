import { signalAddressKey } from '../../protocol/jid.js';
import { resolvePositive } from '../../util/coercion.js';
import { setBoundedMapEntry } from '../../util/collections.js';
const DEFAULT_MAX_REMOTE_IDENTITIES = 8192;
export class WaIdentityMemoryStore {
    constructor(options = {}) {
        this.onEvict = (key) => this.onEntryRemove(key);
        this.remoteIdentities = new Map();
        this.maxRemoteIdentities = resolvePositive(options.maxRemoteIdentities, DEFAULT_MAX_REMOTE_IDENTITIES, 'WaIdentityMemoryStoreOptions.maxRemoteIdentities');
    }
    async getRemoteIdentity(address) {
        const key = signalAddressKey(address);
        const identityKey = this.remoteIdentities.get(key);
        if (identityKey === undefined)
            return null;
        this.onEntryAccess(key);
        return identityKey;
    }
    async getRemoteIdentities(addresses) {
        const result = new Array(addresses.length);
        for (let i = 0; i < addresses.length; i += 1) {
            const key = signalAddressKey(addresses[i]);
            const identityKey = this.remoteIdentities.get(key);
            if (identityKey === undefined) {
                result[i] = null;
            }
            else {
                this.onEntryAccess(key);
                result[i] = identityKey;
            }
        }
        return result;
    }
    async setRemoteIdentity(address, identityKey) {
        const key = signalAddressKey(address);
        setBoundedMapEntry(this.remoteIdentities, key, identityKey, this.maxRemoteIdentities, this.onEvict);
        this.onEntryAccess(key);
    }
    async setRemoteIdentities(entries) {
        for (const entry of entries) {
            const key = signalAddressKey(entry.address);
            setBoundedMapEntry(this.remoteIdentities, key, entry.identityKey, this.maxRemoteIdentities, this.onEvict);
            this.onEntryAccess(key);
        }
    }
    async clear() {
        this.remoteIdentities.clear();
        this.onEntriesClear();
    }
    /** Runs with the key of every read hit and write. No-op unless a subclass tracks access. */
    onEntryAccess(key) { }
    /** Runs with the key of every cap-evicted entry. */
    onEntryRemove(key) { }
    onEntriesClear() { }
}
