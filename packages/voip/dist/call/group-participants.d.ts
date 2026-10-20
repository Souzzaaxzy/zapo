import type { Logger } from 'zapo-js';
/**
 * `state` of a `<user>` or `<participant>` as the wire spells it: text from a table of its own,
 * not the enum names lowercased (ordinal 2 is `outgoing`, ordinal 10 `cancel_offer`).
 */
export declare const WA_CALL_PARTICIPANT_STATE: Readonly<{
    readonly Invalid: "invalid";
    readonly Connected: "connected";
    readonly Outgoing: "outgoing";
    readonly Receipt: "receipt";
    readonly Rejected: "rejected";
    readonly Terminated: "terminated";
    readonly TimedOut: "timedout";
    readonly Creating: "creating";
    readonly Invisible: "invisible";
    readonly Visible: "visible";
    readonly CancelOffer: "cancel_offer";
    readonly Invited: "invited";
}>;
/** Why a change asks for new keys. The key is per participant: a device leaving keeps it. */
export declare const WA_GROUP_REKEY_REASON: Readonly<{
    readonly ParticipantAdded: "participant_added";
    readonly ParticipantRemoved: "participant_removed";
    /** The `rekey` flag of the update: the server asked, whatever the diff shows. */
    readonly UpdateFlag: "update_flag";
}>;
export type WaGroupRekeyReason = (typeof WA_GROUP_REKEY_REASON)[keyof typeof WA_GROUP_REKEY_REASON];
/** What took a participant off the call. */
export declare const WA_GROUP_REMOVAL_CAUSE: Readonly<{
    /** Left out of a roster, which is always the whole call. */
    readonly Absent: "absent";
    /** Listed as `terminated` or `invalid`. */
    readonly Departed: "departed";
    /** Listed as `rejected`, `timedout` or `cancel_offer`. */
    readonly DepartedUnexpected: "departed_unexpected";
    /** Carrying the in-band nack, whatever its state said. */
    readonly Nacked: "nacked";
}>;
export type WaGroupRemovalCause = (typeof WA_GROUP_REMOVAL_CAUSE)[keyof typeof WA_GROUP_REMOVAL_CAUSE];
/** One participant of a group call. */
export interface WaCallGroupParticipant {
    /** The account jid; matched through {@link groupParticipantAccountKey}, never as text. */
    readonly jid: string;
    /** Device jids, primary first, at most five. Empty for a nacked participant. */
    readonly devices: readonly string[];
    /** One of {@link WA_CALL_PARTICIPANT_STATE}. Absent reports no departure. */
    readonly state?: string;
    /** The in-band nack, which overrides the state. */
    readonly nacked?: boolean;
    /**
     * `<device pid>` per device jid, from the roster that carried one; 0 is a real pid. A pid
     * that changes is not a change of who is on the call.
     */
    readonly devicePids?: Readonly<Record<string, number>>;
}
/** The composition this client holds for one group call. */
export interface WaGroupComposition {
    readonly participants: readonly WaCallGroupParticipant[];
    /** `transaction-id` of the last roster folded in, `null` before the first. */
    readonly lastTransactionId: number | null;
}
/** A `group_update` reduced to what reconciliation reads. */
export interface WaGroupUpdate {
    readonly transactionId: number;
    /**
     * The whole roster of the update's `<group_info>`: whoever it leaves out is off the call.
     * `undefined` when the update carried none, which leaves the composition alone.
     */
    readonly participants?: readonly WaCallGroupParticipant[];
    readonly rekey?: boolean;
}
/**
 * A participant that replaced its single device with another. The caller recreates its
 * streams and terminates the old device with `device_switch`; the keys stay.
 */
export interface WaGroupDeviceSwitch {
    readonly jid: string;
    readonly participant: WaCallGroupParticipant;
    readonly previousDeviceJid: string;
    readonly deviceJid: string;
}
/** A device gained or lost by a participant who stays on the call. */
export interface WaGroupDeviceChange {
    readonly jid: string;
    readonly participant: WaCallGroupParticipant;
    readonly deviceJid: string;
}
/** A participant taken off the call, as the call held it. */
export interface WaGroupRemoval {
    readonly jid: string;
    readonly participant: WaCallGroupParticipant;
    readonly cause: WaGroupRemovalCause;
}
/** What one update did to the composition. The lists do not overlap. */
export interface WaGroupCompositionDiff {
    readonly added: readonly WaCallGroupParticipant[];
    readonly switched: readonly WaGroupDeviceSwitch[];
    readonly removed: readonly WaGroupRemoval[];
    readonly devicesAdded: readonly WaGroupDeviceChange[];
    readonly devicesRemoved: readonly WaGroupDeviceChange[];
    /** Whether the change crossed the per-participant key boundary. */
    readonly rekeyRequired: boolean;
    readonly rekeyReason: WaGroupRekeyReason | null;
}
export type WaGroupUpdateOutcome = {
    readonly applied: true;
    readonly composition: WaGroupComposition;
    readonly diff: WaGroupCompositionDiff;
} | {
    readonly applied: false;
    readonly discardReason: 'stale';
    readonly transactionId: number;
    readonly lastTransactionId: number;
} | {
    readonly applied: false;
    readonly discardReason: 'no_roster';
    readonly transactionId: number;
};
/** Whether a `state` names a participant on the call or arriving; false is not a departure. */
export declare function isGroupParticipantPresent(state: string): boolean;
/** Whether an update reports this participant off the call, by nack or by state. */
export declare function isGroupParticipantLeaving(participant: WaCallGroupParticipant): boolean;
export declare function createGroupComposition(participants: readonly WaCallGroupParticipant[], transactionId?: number | null): WaGroupComposition;
/**
 * Diffs a whole roster against the composition in hand. A state outside
 * {@link WA_CALL_PARTICIPANT_STATE} keeps its participant and is logged: tearing down someone
 * present cannot be undone, keeping someone a moment too long can.
 */
export declare function diffGroupParticipants(current: readonly WaCallGroupParticipant[], incoming: readonly WaCallGroupParticipant[], logger: Logger): WaGroupCompositionDiff;
/** Whether an update repeats or predates the `transaction-id` already applied. */
export declare function isStaleGroupUpdate(composition: WaGroupComposition, update: WaGroupUpdate): boolean;
/**
 * Folds one update into a composition. A roster replaces the composition minus whoever it
 * reports leaving; an update without one moves neither the participants nor the counter.
 */
export declare function applyGroupUpdate(composition: WaGroupComposition, update: WaGroupUpdate, logger: Logger): WaGroupUpdateOutcome;
