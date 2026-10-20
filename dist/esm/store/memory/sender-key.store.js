import { signalAddressKey } from '../../protocol/jid.js';
import { resolvePositive } from '../../util/coercion.js';
import { setBoundedMapEntry } from '../../util/collections.js';
const DEFAULT_SENDER_KEY_STORE_LIMITS = Object.freeze({
    senderKeys: 8192,
    senderDistributions: 8192
});
export class SenderKeyMemoryStore {
    constructor(options = {}) {
        this.onSenderKeyEvict = (key) => this.onEntryRemove(this.senderKeys, key);
        this.onDistributionEvict = (key) => this.onEntryRemove(this.senderDistributions, key);
        this.senderKeys = new Map();
        this.senderDistributions = new Map();
        this.maxSenderKeys = resolvePositive(options.maxSenderKeys, DEFAULT_SENDER_KEY_STORE_LIMITS.senderKeys, 'WaSenderKeyMemoryStoreOptions.maxSenderKeys');
        this.maxSenderDistributions = resolvePositive(options.maxSenderDistributions, DEFAULT_SENDER_KEY_STORE_LIMITS.senderDistributions, 'WaSenderKeyMemoryStoreOptions.maxSenderDistributions');
    }
    async upsertSenderKey(record) {
        const key = this.makeKey(record.groupId, record.sender);
        setBoundedMapEntry(this.senderKeys, key, record, this.maxSenderKeys, this.onSenderKeyEvict);
        this.onEntryAccess(this.senderKeys, key);
    }
    async upsertSenderKeyDistribution(record) {
        const key = this.makeKey(record.groupId, record.sender);
        setBoundedMapEntry(this.senderDistributions, key, record, this.maxSenderDistributions, this.onDistributionEvict);
        this.onEntryAccess(this.senderDistributions, key);
    }
    async upsertSenderKeyDistributions(records) {
        for (const record of records) {
            const key = this.makeKey(record.groupId, record.sender);
            setBoundedMapEntry(this.senderDistributions, key, record, this.maxSenderDistributions, this.onDistributionEvict);
            this.onEntryAccess(this.senderDistributions, key);
        }
    }
    async getGroupSenderKeyList(groupId) {
        const skList = [];
        const skDistribList = [];
        for (const record of this.senderKeys.values()) {
            if (record.groupId === groupId) {
                skList.push(record);
            }
        }
        for (const record of this.senderDistributions.values()) {
            if (record.groupId === groupId) {
                skDistribList.push(record);
            }
        }
        return {
            skList,
            skDistribList
        };
    }
    async getDeviceSenderKey(groupId, sender) {
        const key = this.makeKey(groupId, sender);
        const record = this.senderKeys.get(key);
        if (record === undefined)
            return null;
        this.onEntryAccess(this.senderKeys, key);
        return record;
    }
    async getDeviceSenderKeyDistributions(groupId, senders) {
        const records = new Array(senders.length);
        for (let index = 0; index < senders.length; index += 1) {
            const key = this.makeKey(groupId, senders[index]);
            const record = this.senderDistributions.get(key);
            if (record === undefined) {
                records[index] = null;
            }
            else {
                this.onEntryAccess(this.senderDistributions, key);
                records[index] = record;
            }
        }
        return records;
    }
    async deleteDeviceSenderKey(target, groupId) {
        let deleted = 0;
        deleted += this.deleteMatching(this.senderKeys, target, groupId);
        deleted += this.deleteMatching(this.senderDistributions, target, groupId);
        return deleted;
    }
    async markForgetSenderKey(groupId, participants) {
        let deleted = 0;
        for (let index = 0; index < participants.length; index += 1) {
            const participant = participants[index];
            deleted += this.deleteMatching(this.senderKeys, participant, groupId);
            deleted += this.deleteMatching(this.senderDistributions, participant, groupId);
        }
        return deleted;
    }
    async clear() {
        this.senderKeys.clear();
        this.senderDistributions.clear();
        this.onEntriesClear();
    }
    /**
     * Runs with the map and key of every point-read hit and write (the group
     * scan does not count). No-op unless a subclass tracks access.
     */
    onEntryAccess(entries, key) { }
    /** Runs with the map and key of every deleted or cap-evicted entry. */
    onEntryRemove(entries, key) { }
    onEntriesClear() { }
    deleteMatching(map, target, groupId) {
        let deleted = 0;
        const targetAddressKey = signalAddressKey(target);
        for (const [key, record] of map.entries()) {
            const sameGroup = groupId ? record.groupId === groupId : true;
            const sameAddress = signalAddressKey(record.sender) === targetAddressKey;
            if (sameGroup && sameAddress) {
                map.delete(key);
                this.onEntryRemove(map, key);
                deleted += 1;
            }
        }
        return deleted;
    }
    makeKey(groupId, sender) {
        return `${groupId}|${signalAddressKey(sender)}`;
    }
}
