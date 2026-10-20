import { SenderKeyMemoryStore } from '../memory/sender-key.store.js';
import { IdleExpiryIndex } from '../../util/collections.js';
/** L1 with idle expiry; hits keep both maps in access order, so the caps evict LRU entries. */
class IdleSenderKeyMemoryStore extends SenderKeyMemoryStore {
    constructor(maxEntries, expiry) {
        super({ maxSenderKeys: maxEntries, maxSenderDistributions: maxEntries });
        this.idleSenderKeys = new IdleExpiryIndex(this.senderKeys, expiry);
        this.idleDistributions = new IdleExpiryIndex(this.senderDistributions, expiry);
    }
    detach() {
        this.idleSenderKeys.detach();
        this.idleDistributions.detach();
    }
    onEntryAccess(entries, key) {
        this.indexFor(entries).touch(key);
    }
    onEntryRemove(entries, key) {
        this.indexFor(entries).delete(key);
    }
    onEntriesClear() {
        this.idleSenderKeys.clear();
        this.idleDistributions.clear();
    }
    indexFor(entries) {
        return entries === this.senderKeys ? this.idleSenderKeys : this.idleDistributions;
    }
}
/**
 * Read-through / write-through in-process cache for a persistent sender-key
 * backend. Reuses {@link SenderKeyMemoryStore} as the bounded L1 so the
 * per-(group, sender) lookups repeated across a group fan-out skip the
 * backend round-trip.
 *
 * Only the point reads are cached. `getGroupSenderKeyList` returns the
 * *complete* set for a group, which a partial point cache would under-report,
 * so it goes straight to the backend. Upserts replace the whole record (no
 * merge), so they are write-through; the sweep deletes
 * (`deleteDeviceSenderKey`/`markForgetSenderKey`) run on the backend for the
 * authoritative count and then invalidate the matching L1 entries via the
 * memory store's own sweep. See {@link withSessionCache} for the shared
 * coherence model, the single-writer-per-session assumption and the eviction
 * with and without `expiry`.
 */
export function withSenderKeyCache(backend, maxEntries, expiry) {
    const l1 = expiry
        ? new IdleSenderKeyMemoryStore(maxEntries, expiry)
        : new SenderKeyMemoryStore({
            maxSenderKeys: maxEntries,
            maxSenderDistributions: maxEntries
        });
    let generation = 0;
    return {
        upsertSenderKey: async (record) => {
            generation += 1;
            await backend.upsertSenderKey(record);
            await l1.upsertSenderKey(record);
        },
        upsertSenderKeyDistribution: async (record) => {
            generation += 1;
            await backend.upsertSenderKeyDistribution(record);
            await l1.upsertSenderKeyDistribution(record);
        },
        upsertSenderKeyDistributions: async (records) => {
            generation += 1;
            await backend.upsertSenderKeyDistributions(records);
            await l1.upsertSenderKeyDistributions(records);
        },
        getGroupSenderKeyList: (groupId) => backend.getGroupSenderKeyList(groupId),
        getDeviceSenderKey: async (groupId, sender) => {
            const cached = await l1.getDeviceSenderKey(groupId, sender);
            if (cached !== null)
                return cached;
            const gen = generation;
            const fetched = await backend.getDeviceSenderKey(groupId, sender);
            if (fetched !== null &&
                gen === generation &&
                (await l1.getDeviceSenderKey(groupId, sender)) === null) {
                await l1.upsertSenderKey(fetched);
            }
            return fetched;
        },
        getDeviceSenderKeyDistributions: async (groupId, senders) => {
            const cached = await l1.getDeviceSenderKeyDistributions(groupId, senders);
            const missing = [];
            for (let i = 0; i < senders.length; i += 1) {
                if (cached[i] === null)
                    missing.push(i);
            }
            if (missing.length === 0)
                return cached;
            const gen = generation;
            const fetched = await backend.getDeviceSenderKeyDistributions(groupId, missing.map((i) => senders[i]));
            const coherent = gen === generation;
            const result = cached.slice();
            for (let j = 0; j < missing.length; j += 1) {
                const record = fetched[j];
                result[missing[j]] = record;
                if (record !== null && coherent) {
                    const [current] = await l1.getDeviceSenderKeyDistributions(groupId, [
                        senders[missing[j]]
                    ]);
                    if (current === null)
                        await l1.upsertSenderKeyDistribution(record);
                }
            }
            return result;
        },
        deleteDeviceSenderKey: async (target, groupId) => {
            generation += 1;
            const deleted = await backend.deleteDeviceSenderKey(target, groupId);
            await l1.deleteDeviceSenderKey(target, groupId);
            return deleted;
        },
        markForgetSenderKey: async (groupId, participants) => {
            generation += 1;
            const deleted = await backend.markForgetSenderKey(groupId, participants);
            await l1.markForgetSenderKey(groupId, participants);
            return deleted;
        },
        clear: async () => {
            generation += 1;
            await backend.clear();
            await l1.clear();
        },
        destroy: async () => {
            if (l1 instanceof IdleSenderKeyMemoryStore)
                l1.detach();
            await l1.clear();
            await backend.destroy?.();
        }
    };
}
