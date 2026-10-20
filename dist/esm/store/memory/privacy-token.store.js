import { resolvePositive } from '../../util/coercion.js';
import { setBoundedMapEntry } from '../../util/collections.js';
const DEFAULT_MAX_ENTRIES = 10000;
export class WaPrivacyTokenMemoryStore {
    constructor(maxEntries) {
        this.onEvict = (jid) => this.onEntryRemove(jid);
        this.records = new Map();
        this.maxEntries = resolvePositive(maxEntries, DEFAULT_MAX_ENTRIES, 'WaPrivacyTokenMemoryStore.maxEntries');
    }
    async upsert(record) {
        const existing = this.records.get(record.jid);
        const merged = existing ? this.mergeRecord(existing, record) : record;
        setBoundedMapEntry(this.records, record.jid, merged, this.maxEntries, this.onEvict);
        this.onEntryAccess(record.jid);
    }
    async upsertBatch(records) {
        for (let i = 0; i < records.length; i += 1) {
            const record = records[i];
            const existing = this.records.get(record.jid);
            const merged = existing ? this.mergeRecord(existing, record) : record;
            setBoundedMapEntry(this.records, record.jid, merged, this.maxEntries, this.onEvict);
            this.onEntryAccess(record.jid);
        }
    }
    async getByJid(jid) {
        const record = this.records.get(jid);
        if (record === undefined)
            return null;
        this.onEntryAccess(jid);
        return record;
    }
    async deleteByJid(jid) {
        if (!this.records.delete(jid))
            return 0;
        this.onEntryRemove(jid);
        return 1;
    }
    async clear() {
        this.records.clear();
        this.onEntriesClear();
    }
    async destroy() {
        await this.clear();
    }
    /** Runs with the jid of every read hit and write. No-op unless a subclass tracks access. */
    onEntryAccess(jid) { }
    /** Runs with the jid of every deleted or cap-evicted record. */
    onEntryRemove(jid) { }
    onEntriesClear() { }
    mergeRecord(existing, incoming) {
        return {
            jid: incoming.jid,
            tcToken: incoming.tcToken ?? existing.tcToken,
            tcTokenTimestamp: incoming.tcTokenTimestamp ?? existing.tcTokenTimestamp,
            tcTokenSenderTimestamp: incoming.tcTokenSenderTimestamp ?? existing.tcTokenSenderTimestamp,
            nctSalt: incoming.nctSalt ?? existing.nctSalt,
            updatedAtMs: incoming.updatedAtMs
        };
    }
}
