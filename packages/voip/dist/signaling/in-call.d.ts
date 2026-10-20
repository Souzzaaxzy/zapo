import { type BinaryNode } from 'zapo-js/transport';
/**
 * Builds the `<call><mute_v2>` that announces our own microphone state: `mute-state` on
 * `mute_v2` itself, no child node. A statement, not a request - nothing comes back. Asking
 * another participant to mute is {@link buildMuteRequestStanza}.
 */
export declare function buildMuteV2Stanza(peerDeviceJid: string, callId: string, callCreator: string, muted: boolean): BinaryNode;
/** `request-state` of a `<mute_v2>` asking its target to mute; the only value seen on the wire. */
export declare const WA_MUTE_REQUEST_STATE: Readonly<{
    readonly Mute: "1";
}>;
/**
 * Builds the `<call><mute_v2>` that asks one participant of a group call to mute: addressed to
 * its device, `request-state` and no `mute-state`. The target decides, and announces its own
 * `mute-state` if it complies.
 */
export declare function buildMuteRequestStanza(targetDeviceJid: string, callId: string, callCreator: string, requestState?: string): BinaryNode;
interface MuteV2Payload {
    /**
     * Microphone state the sender announced through `mute-state`. `null` when absent or
     * unrecognized, so an unknown state is never guessed into a boolean.
     */
    readonly muted: boolean | null;
    /** `true` when the stanza carries `request-state`: a request, not an announcement. */
    readonly isRequest: boolean;
    /** `request-state` as it arrived, `null` when absent. */
    readonly requestState: string | null;
}
/** Reads the state carried by an inbound `<mute_v2>` node. */
export declare function parseMuteV2(inner: BinaryNode): MuteV2Payload;
/**
 * Builds the `<call><user_action>` announcing the local raise-hand state; lowering writes `'0'`
 * rather than dropping the attribute. `broadcast` is off unless asked for.
 */
export declare function buildRaiseHandStanza(peerDeviceJid: string, callId: string, callCreator: string, raised: boolean, broadcast?: boolean): BinaryNode;
/**
 * Reads the raise-hand state of a `<user_action>` envelope or a standalone `<raise_hand>`;
 * `null` when absent or anything other than `0`/`1`.
 */
export declare function parseRaiseHandState(node: BinaryNode): boolean | null;
export {};
