import type { WaPrivacyTokenStore } from '../contracts/privacy-token.store';
import type { WithDestroyLifecycle } from '../types';
import { type IdleExpiry } from '../../util/collections';
/**
 * Read-through cache for a persistent privacy-token backend. Reuses
 * {@link WaPrivacyTokenMemoryStore} as the bounded L1.
 *
 * Unlike the signal caches this is **invalidate-on-write, not
 * write-through**: `upsert` merges partial fields into the existing row on
 * the backend, so caching the partial incoming record would diverge from the
 * backend's merged result. Instead each upsert drops the L1 entry and the
 * next read re-populates from the merged backend truth. See
 * {@link withSessionCache} for the shared coherence model, the
 * single-writer-per-session assumption and the eviction with and without
 * `expiry`.
 */
export declare function withPrivacyTokenCache(backend: WaPrivacyTokenStore, maxEntries?: number, expiry?: IdleExpiry): WithDestroyLifecycle<WaPrivacyTokenStore>;
