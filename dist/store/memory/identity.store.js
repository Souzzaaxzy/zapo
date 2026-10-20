"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaIdentityMemoryStore = void 0;
const jid_1 = require("../../protocol/jid");
const coercion_1 = require("../../util/coercion");
const collections_1 = require("../../util/collections");
const DEFAULT_MAX_REMOTE_IDENTITIES = 8192;
class WaIdentityMemoryStore {
    constructor(options = {}) {
        this.onEvict = (key) => this.onEntryRemove(key);
        this.remoteIdentities = new Map();
        this.maxRemoteIdentities = (0, coercion_1.resolvePositive)(options.maxRemoteIdentities, DEFAULT_MAX_REMOTE_IDENTITIES, 'WaIdentityMemoryStoreOptions.maxRemoteIdentities');
    }
    async getRemoteIdentity(address) {
        const key = (0, jid_1.signalAddressKey)(address);
        const identityKey = this.remoteIdentities.get(key);
        if (identityKey === undefined)
            return null;
        this.onEntryAccess(key);
        return identityKey;
    }
    async getRemoteIdentities(addresses) {
        const result = new Array(addresses.length);
        for (let i = 0; i < addresses.length; i += 1) {
            const key = (0, jid_1.signalAddressKey)(addresses[i]);
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
        const key = (0, jid_1.signalAddressKey)(address);
        (0, collections_1.setBoundedMapEntry)(this.remoteIdentities, key, identityKey, this.maxRemoteIdentities, this.onEvict);
        this.onEntryAccess(key);
    }
    async setRemoteIdentities(entries) {
        for (const entry of entries) {
            const key = (0, jid_1.signalAddressKey)(entry.address);
            (0, collections_1.setBoundedMapEntry)(this.remoteIdentities, key, entry.identityKey, this.maxRemoteIdentities, this.onEvict);
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
exports.WaIdentityMemoryStore = WaIdentityMemoryStore;
