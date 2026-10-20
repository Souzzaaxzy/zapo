import { signalAddressKey } from '../../protocol/jid.js';
import { resolvePositive } from '../../util/coercion.js';
import { setBoundedMapEntry } from '../../util/collections.js';
const DEFAULT_MAX_SESSIONS = 8192;
export class WaSessionMemoryStore {
    constructor(options = {}) {
        this.onEvict = (key) => this.onEntryRemove(key);
        this.signalSessions = new Map();
        this.maxSessions = resolvePositive(options.maxSessions, DEFAULT_MAX_SESSIONS, 'WaSessionMemoryStoreOptions.maxSessions');
    }
    async hasSession(address) {
        const key = signalAddressKey(address);
        if (!this.signalSessions.has(key))
            return false;
        this.onEntryAccess(key);
        return true;
    }
    async hasSessions(addresses) {
        const result = new Array(addresses.length);
        for (let i = 0; i < addresses.length; i += 1) {
            const key = signalAddressKey(addresses[i]);
            const found = this.signalSessions.has(key);
            if (found)
                this.onEntryAccess(key);
            result[i] = found;
        }
        return result;
    }
    async getSession(address) {
        const key = signalAddressKey(address);
        const session = this.signalSessions.get(key);
        if (session === undefined)
            return null;
        this.onEntryAccess(key);
        return session;
    }
    async getSessionsBatch(addresses) {
        const result = new Array(addresses.length);
        for (let i = 0; i < addresses.length; i += 1) {
            const key = signalAddressKey(addresses[i]);
            const session = this.signalSessions.get(key);
            if (session === undefined) {
                result[i] = null;
            }
            else {
                this.onEntryAccess(key);
                result[i] = session;
            }
        }
        return result;
    }
    async setSession(address, session) {
        const key = signalAddressKey(address);
        setBoundedMapEntry(this.signalSessions, key, session, this.maxSessions, this.onEvict);
        this.onEntryAccess(key);
    }
    async setSessionsBatch(entries) {
        for (let index = 0; index < entries.length; index += 1) {
            const entry = entries[index];
            const key = signalAddressKey(entry.address);
            setBoundedMapEntry(this.signalSessions, key, entry.session, this.maxSessions, this.onEvict);
            this.onEntryAccess(key);
        }
    }
    async deleteSession(address) {
        const key = signalAddressKey(address);
        if (this.signalSessions.delete(key))
            this.onEntryRemove(key);
    }
    async clear() {
        this.signalSessions.clear();
        this.onEntriesClear();
    }
    /** Runs with the key of every read hit and write. No-op unless a subclass tracks access. */
    onEntryAccess(key) { }
    /** Runs with the key of every deleted or cap-evicted entry. */
    onEntryRemove(key) { }
    onEntriesClear() { }
}
