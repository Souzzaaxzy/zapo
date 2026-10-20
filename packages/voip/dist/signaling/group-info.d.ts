import { type BinaryNode } from 'zapo-js/transport';
import type { WaCallGroupParticipant } from '../call/group-participants.js';
/** How many devices one participant may bring into a call; a longer list is refused whole. */
export declare const WA_CALL_MAX_DEVICES_PER_USER = 5;
/** One `<device>` of a participant. Every attribute but the jid is optional on the wire. */
export interface GroupInfoDevice {
    /** The device jid, always carrying its `:device` segment. */
    readonly jid: string;
    readonly deviceId: number;
    /** `pid`, the device's media index: absent from the offer, set after the accept. */
    readonly pid: number | null;
    readonly dec: string | null;
    readonly enc: string | null;
    /** `vid_dec`, a comma-separated codec list. */
    readonly vidDec: string | null;
    readonly platform: string | null;
    /** `capability`, the packed capability blob as it arrived. */
    readonly capability: string | null;
    readonly capabilityVersion: number | null;
    readonly capabilityBitMaskLength: number | null;
}
/**
 * One participant, from either `<user>` or `<participant>`; the two never share a
 * `<group_info>` and each fills its own subset of these fields.
 */
export interface GroupInfoParticipant {
    readonly jid: string;
    /** Whether the server reported this participant as not joining (`reason` or `error`). */
    readonly nacked: boolean;
    readonly reason: string | null;
    /** `state` as text, one of `WA_CALL_PARTICIPANT_STATE`. */
    readonly state: string | null;
    readonly phash: string | null;
    /** `user_pn`: identity only, never a media address. */
    readonly userPn: string | null;
    readonly username: string | null;
    readonly pushName: string | null;
    readonly guestName: string | null;
    readonly countryCode: string | null;
    readonly accountKind: string | null;
    /** `tos_not_accepted`: left out of the rekey fan-out. */
    readonly tosNotAccepted: boolean;
    /** `<participant>` only from here down. */
    readonly media: string | null;
    readonly rekey: boolean;
    readonly transactionId: number | null;
    readonly linkToken: string | null;
    readonly decExtensionId: string | null;
    readonly hnVideo: string | null;
    /** Primary first, empty for a nacked participant. */
    readonly devices: readonly GroupInfoDevice[];
}
/** The `<group_info>` of an offer or of a `group_update`. */
export interface GroupInfo {
    readonly media: string;
    readonly connectedLimit: number;
    /** `rekey` on `<group_info>` itself: the receiver mints the next key and hands it round. */
    readonly rekey: boolean;
    /** `transaction-id` on `<group_info>` itself; the `<group_update>` around it carries none. */
    readonly transactionId: number | null;
    readonly linkToken: string | null;
    readonly phash: string | null;
    /** Mutually exclusive with {@link lightweightKey}. */
    readonly groupPhash: string | null;
    readonly lightweightKey: string | null;
    readonly extensionId: string | null;
    readonly participantTag: 'user' | 'participant' | null;
    readonly participants: readonly GroupInfoParticipant[];
}
/**
 * Reads a `<group_info>`. Throws on the stanzas the peer itself refuses: missing `media` or
 * `connected_limit`, `group_phash` with `lightweight_key`, `<user>` with `<participant>`, a
 * missing jid, more than {@link WA_CALL_MAX_DEVICES_PER_USER} devices, or a `<user>` whose
 * device count disagrees with its nack.
 */
export declare function parseGroupInfoNode(node: BinaryNode): GroupInfo;
/** The participants of a parsed `<group_info>` in the shape the reconciler reads. */
export declare function toGroupCallParticipants(info: GroupInfo): readonly WaCallGroupParticipant[];
/** What the `<group_info>` of a call stanza says about who is on the call. */
export type GroupCallRoster = {
    readonly kind: 'roster';
    readonly info: GroupInfo;
    readonly participants: readonly WaCallGroupParticipant[];
} | {
    readonly kind: 'absent';
} | {
    readonly kind: 'empty';
};
/**
 * Reads the roster off an `<offer>` or `<group_update>`. A `<group_info>` listing nobody is
 * `empty` and treated as no roster: emptying a live call cannot be undone, keeping it can.
 *
 * @throws through {@link parseGroupInfoNode}.
 */
export declare function readGroupCallRoster(inner: BinaryNode): GroupCallRoster;
/** The `transaction-id` of a `group_update`: its `<group_info>`'s, else the wrapper's. */
export declare function readGroupUpdateTransactionId(inner: BinaryNode): number | null;
/**
 * The number a `group_update` is ordered by: its `<group_info>`'s, else the wrapper's, else the
 * highest a participant carries, else one past the last applied.
 */
export declare function resolveGroupUpdateTransactionId(inner: BinaryNode, listed: readonly GroupInfoParticipant[], lastTransactionId: number | null, rosterTransactionId: number | null): number;
/**
 * The devices a participant addresses, each with its `:device`, primary first. A count
 * outside one to five collapses onto the primary device of the user jid.
 *
 * @throws when the user jid and its devices disagree on being a LID.
 */
export declare function normalizeParticipantDeviceJids(userJid: string, deviceJids: readonly string[]): readonly string[];
