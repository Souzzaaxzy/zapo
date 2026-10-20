import { type Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import type { WaCallGroupParticipant } from '../call/group-participants.js';
import type { CallOfferParticipant, WaVoipDeps } from '../types.js';
/** A group `<offer>` and the participants it named, creator first, devices addressed. */
interface GroupOfferStanza {
    readonly node: BinaryNode;
    readonly participants: readonly WaCallGroupParticipant[];
}
/**
 * The most accounts a group `<offer>`'s `<group_info>` may name, ourselves included.
 *
 * Measured: the server refuses an offer that names more, with `error: '427'` on the
 * `<ack>` (`handleCallAck` -> `SetupFailed`). The ceiling is the roster bound the
 * official client enforces (`GroupInfoStanza.MAX_PARTICIPANTS = 0x7f`), not the
 * 32-participant limit of a *connected* call: a group of 128 members overflows it by
 * one, because the creator counts. Naming fewer is always accepted.
 */
export declare const WA_GROUP_OFFER_MAX_ACCOUNTS = 127;
/**
 * Builds the `<offer>` that places a group call: addressed to `<call-id>@call`, with the
 * participants in an attribute-less `<group_info>` (creator first, with only the device placing the
 * call, the only one carrying a `<capability>`) and no `<destination>`, `<enc>`, `<encopt>` or `<device-identity>`: the key
 * arrives later over `enc_rekey`. The server fills `joinable` and the `<group_info>` attributes.
 *
 * `isLightweight` places a voice chat instead of a ringing call: the offer carries `lightweight='1'`
 * and announces `<silence>`, so joining the group does not make everyone's phone ring. See
 * {@link buildOfferMediaNodes}.
 *
 * @throws with no own jid, with nobody left to ring, or through
 * {@link normalizeParticipantDeviceJids}.
 */
export declare function buildGroupOfferStanza(deps: WaVoipDeps, callId: string, groupJid: string, participants: readonly CallOfferParticipant[], isVideo: boolean, isLightweight?: boolean, logger?: Logger): Promise<GroupOfferStanza>;
interface EncRekeyStanzaParams {
    readonly callId: string;
    readonly callCreator: string;
    /** The `transaction-id` of the `<group_info>` that asked for this rekey. */
    readonly transactionId: number;
    readonly peerDeviceJid: string;
    /** The new 32-byte call key, already installed on this side. */
    readonly callKey: Uint8Array;
}
/**
 * Builds the `<enc_rekey>` carrying a new call key to one device: `transaction-id` echoing the
 * `<group_info>` that asked, `<encopt keygen='2'/>`, a direct `<enc>`, `<device-identity>` on a `pkmsg`.
 *
 * @throws when there is no Signal session for the device; a fan-out contains it per device.
 */
export declare function buildEncRekeyStanza(deps: WaVoipDeps, params: EncRekeyStanzaParams): Promise<BinaryNode>;
/**
 * Builds the `<call><heartbeat>` every connected member of a group call sends the call itself,
 * every 10 s, whether it answered, placed or joined the call.
 */
export declare function buildHeartbeatStanza(callId: string, callCreator: string): BinaryNode;
/** The `state` a `<peer_state>` reports for a peer; only `Invisible` has been seen on the wire. */
export declare const WA_PEER_STATE: Readonly<{
    readonly Invisible: "invisible";
    readonly Visible: "visible";
}>;
/** One of the values of {@link WA_PEER_STATE}. */
type WaPeerState = (typeof WA_PEER_STATE)[keyof typeof WA_PEER_STATE];
/**
 * Builds the `<call><peer_state>` telling the server what this side sees of one group-call member,
 * named by its account (a device suffix is dropped). `Invisible` is a member whose media stopped
 * reaching us; the server takes it off the call. `t` is in epoch milliseconds.
 */
export declare function buildPeerStateStanza(callId: string, callCreator: string, peerAccountJid: string, state: WaPeerState, nowMs?: number): BinaryNode;
/**
 * Builds the `<receipt>` answering an `<enc_rekey>`, sent whether or not its key decrypted;
 * the child names the call, `call-creator` before `call-id`.
 */
export declare function buildEncRekeyReceiptStanza(peerDeviceJid: string, rekeyMsgId: string, callId: string, callCreator: string, ourJid: string): BinaryNode;
export {};
