/** A call key an `<enc_rekey>` delivered before its call existed. */
export interface PendingCallKey {
    readonly callKey: Uint8Array;
    readonly transactionId: number | null;
}
/** Call stanzas that arrived out of order with their call: held, or remembered to be dropped. */
export declare class WaOutOfOrderStanzas {
    /**
     * Call ids a `<terminate>` ended before their offer made a call, with when that
     * expires: the offer can still be decrypting when the terminate lands.
     */
    private readonly terminatedBeforeOffer;
    /** Group call keys that arrived ahead of their call, by call id. */
    private readonly pendingCallKeys;
    /**
     * Calls that ended here: a group call left goes on, and the server's terminates for it
     * must neither be held against a later offer nor reported.
     */
    private readonly recentlyEndedCalls;
    holdTerminate(callId: string): void;
    /** Whether a terminate already ended this call before its offer was handled; consumes it. */
    takeHeldTerminate(callId: string): boolean;
    holdCallKey(callId: string, key: PendingCallKey): void;
    takeCallKey(callId: string): PendingCallKey | undefined;
    rememberEnded(callId: string): void;
    endedHere(callId: string): boolean;
    clear(): void;
}
