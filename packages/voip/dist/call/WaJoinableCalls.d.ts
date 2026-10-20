import type { Logger } from 'zapo-js';
import type { BinaryNode } from 'zapo-js/transport';
import { type WaVoipSettings } from '../signaling/voip-settings.js';
import { CallMediaType, type RelayData } from '../types.js';
import type { CallInfo } from './call-state.js';
import type { WaCallGroupParticipant } from './group-participants.js';
/** Why this side is off a joinable call that goes on. */
export type WaJoinableCallCause = 'declined' | 'rung_out' | 'left' | 'invisible';
/**
 * A joinable group call going on without this side, kept for `WaCallManager.joinCall`
 * and followed through its `group_update`s until `group_call_ended`. @internal
 */
export interface WaJoinableCall {
    readonly callId: string;
    readonly callCreator: string;
    readonly groupJid?: string;
    readonly cause: WaJoinableCallCause;
    mediaType: CallMediaType;
    voipSettings?: WaVoipSettings;
    /** The newest `<relay>` seen for the call. */
    relayData?: RelayData;
    /** The `transaction-id` of the update that carried {@link relayData}, `null` when unknown. */
    relayTransactionId: number | null;
    /** The newest roster seen for the call, with its `transaction-id`. */
    participants?: readonly WaCallGroupParticipant[];
    rosterTransactionId: number | null;
}
/** Joinable group calls this side is off, by call id; see {@link WaJoinableCall}. */
export declare class WaJoinableCalls {
    private readonly logger;
    private readonly calls;
    constructor(logger: Logger);
    get(callId: string): WaJoinableCall | undefined;
    remember(info: CallInfo, cause: WaJoinableCallCause): void;
    /** Puts back a call taken for a join that failed. */
    restore(call: WaJoinableCall): void;
    forget(callId: string): boolean;
    /**
     * Folds a `group_update` into the joinable call it names: the newest relay, settings and
     * roster. `false` when no such call is remembered.
     */
    follow(node: BinaryNode, inner: BinaryNode, callId: string): boolean;
    clear(): void;
}
