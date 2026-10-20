import type { Logger } from 'zapo-js';
import type { BinaryNode } from 'zapo-js/transport';
import type { CallInfo } from './call-state.js';
import { type WaCallGroupParticipant, type WaGroupComposition, type WaGroupCompositionDiff } from './group-participants.js';
export interface WaGroupRosterOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    /** Our own jid as the call knows it, empty while unknown. */
    readonly selfJid: () => string;
}
/** Who is on a group call as this side reads it: seeds, departures and account matching. */
export declare class WaGroupRoster {
    private readonly info;
    private readonly logger;
    private readonly selfJid;
    /** Account keys of roster entries, which are replaced whole and never mutated. */
    private readonly accountKeys;
    private selfKeyOf;
    constructor(options: WaGroupRosterOptions);
    /**
     * Seeds the composition from the `<group_info>` of an offer, leaving out whoever it already
     * reports off the call. An unreadable or empty one seeds nothing and gives `null`.
     */
    seedFromOffer(inner: BinaryNode): {
        readonly participantCount: number;
        readonly connectedLimit: number;
    } | null;
    /** Seeds the composition of a call joined after its ring from the last roster kept. */
    seedJoin(participants: readonly WaCallGroupParticipant[], transactionId: number | null): void;
    /** Seeds the composition of a call we place, from the participants our offer named. */
    seedOutgoing(participants: readonly WaCallGroupParticipant[]): void;
    /**
     * Takes `peerJid`'s account off the composition, its counter kept, and returns the change;
     * `null` when it was not on it.
     */
    remove(peerJid: string | undefined, reason: string | undefined): WaGroupCompositionDiff | null;
    logDiff(message: string, diff: WaGroupCompositionDiff, context?: Record<string, unknown>): void;
    selfAccountKey(): string | null;
    accountKeyOf(participant: WaCallGroupParticipant): string;
    /** Every device sending into this group call, ourselves left out. */
    senderDevices(): string[];
    /** The device a jid names on this call, device 0 bare; an account names its first device. */
    participantDeviceOf(jid: string): string | null;
    /** Whether the roster lists somebody but us connected. */
    hasOtherConnected(): boolean;
    /** Whether a roster change brought somebody else in, or connected somebody already listed. */
    anyoneArrived(before: WaGroupComposition, after: WaGroupComposition): boolean;
}
