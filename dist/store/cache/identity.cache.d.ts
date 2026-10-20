import type { WaIdentityStore } from '../contracts/identity.store';
import type { WithDestroyLifecycle } from '../types';
import { type IdleExpiry } from '../../util/collections';
/**
 * Read-through / write-through in-process cache for a persistent remote
 * identity backend. Reuses {@link WaIdentityMemoryStore} as the bounded L1.
 * Remote identities are read alongside sessions on the send path (the
 * identity-mismatch guard), so caching them complements
 * {@link withSessionCache}, which also describes the eviction with and
 * without `expiry`.
 *
 * The identity store has no per-key delete: identities are overwritten on
 * re-establishment, so a peer's key change propagates through the
 * write-through `setRemoteIdentity`. See {@link withSessionCache} for the
 * shared coherence model and the single-writer-per-session assumption.
 */
export declare function withIdentityCache(backend: WaIdentityStore, maxEntries?: number, expiry?: IdleExpiry): WithDestroyLifecycle<WaIdentityStore>;
