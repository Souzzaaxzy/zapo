export declare function resolveCleanupIntervalMs(ttlMs: number, maxIntervalMs?: number): number;
export interface PeriodicCleanupHandle {
    readonly destroy: () => void;
}
export declare function createPeriodicCleanup(ttlMs: number, run: () => void): PeriodicCleanupHandle;
/**
 * Returns a validated positive-safe-integer query limit, falling back to
 * `defaultLimit` when `limit` is undefined. Throws on invalid input.
 */
export declare function normalizeQueryLimit(limit: number | undefined, defaultLimit: number): number;
/**
 * Sweep period shared by a set of idle TTLs: the smallest `ttlMs / 2`,
 * clamped to [1 s, 60 s].
 */
export declare function resolveIdleSweepPeriodMs(ttlsMs: readonly number[]): number;
/**
 * Coarse clock for idle expiry: one `unref`'d interval bumps `tick` and runs
 * every registered sweep, and only while a sweep is registered. Wall-clock
 * steps never move `tick`.
 */
export declare class IdleSweepClock {
    readonly periodMs: number;
    private currentTick;
    private readonly sweeps;
    private timer;
    constructor(periodMs: number);
    get tick(): number;
    /** Runs `sweep` on every tick until the returned function is called. */
    register(sweep: (tick: number) => void): () => void;
    private readonly advance;
}
export interface IdleExpiry {
    readonly clock: IdleSweepClock;
    readonly ttlMs: number;
}
/**
 * Idle expiry and LRU order for the entries of `data`. A touch moves the key
 * to the young end of the index and of `data`, at most once per tick, so the
 * sweep stops at the first live key and `data` iterates least recently used
 * first. A key expires after `ceil(ttlMs / periodMs) + 1` untouched ticks:
 * idle for at least `ttlMs` and, timer lateness aside, under `ttlMs + 2 * periodMs`.
 */
export declare class IdleExpiryIndex<K, V> {
    private readonly data;
    private readonly clock;
    private readonly idleTicks;
    private readonly touchedAt;
    private readonly unregister;
    constructor(data: Map<K, V>, expiry: IdleExpiry);
    touch(key: K): void;
    delete(key: K): void;
    clear(): void;
    /** Stops sweeping; the entries stay until the owner clears them. */
    detach(): void;
    private readonly sweep;
}
export declare function setBoundedMapEntry<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number, onEvict?: (key: K, value: V) => void): void;
