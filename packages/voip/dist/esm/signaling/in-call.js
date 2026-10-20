import { findNodeChild } from 'zapo-js/transport';
import { callStanza } from './call-stanza.js';
/**
 * Builds the `<call><mute_v2>` that announces our own microphone state: `mute-state` on
 * `mute_v2` itself, no child node. A statement, not a request - nothing comes back. Asking
 * another participant to mute is {@link buildMuteRequestStanza}.
 */
export function buildMuteV2Stanza(peerDeviceJid, callId, callCreator, muted) {
    return callStanza(peerDeviceJid, 'mute_v2', callId, callCreator, {
        'mute-state': muted ? '1' : '0'
    });
}
/** `request-state` of a `<mute_v2>` asking its target to mute; the only value seen on the wire. */
export const WA_MUTE_REQUEST_STATE = Object.freeze({ Mute: '1' });
/**
 * Builds the `<call><mute_v2>` that asks one participant of a group call to mute: addressed to
 * its device, `request-state` and no `mute-state`. The target decides, and announces its own
 * `mute-state` if it complies.
 */
export function buildMuteRequestStanza(targetDeviceJid, callId, callCreator, requestState = WA_MUTE_REQUEST_STATE.Mute) {
    return callStanza(targetDeviceJid, 'mute_v2', callId, callCreator, {
        'request-state': requestState
    });
}
/** Reads the state carried by an inbound `<mute_v2>` node. */
export function parseMuteV2(inner) {
    const rawMuteState = inner.attrs?.['mute-state'];
    let muted = null;
    if (rawMuteState === '1') {
        muted = true;
    }
    else if (rawMuteState === '0') {
        muted = false;
    }
    const requestState = inner.attrs?.['request-state'] ?? null;
    return { muted, isRequest: requestState !== null, requestState };
}
/** `action` of the `<user_action>`, tag of its state child, and tag of the standalone stanza. */
const RAISE_HAND_ACTION = 'raise_hand';
/** The state attribute in both shapes, always hyphenated. */
const RAISE_HAND_STATE_ATTR = 'raise-hand-state';
/**
 * Builds the `<call><user_action>` announcing the local raise-hand state; lowering writes `'0'`
 * rather than dropping the attribute. `broadcast` is off unless asked for.
 */
export function buildRaiseHandStanza(peerDeviceJid, callId, callCreator, raised, broadcast = false) {
    const attrs = { action: RAISE_HAND_ACTION };
    if (broadcast) {
        attrs.broadcast = '1';
    }
    return callStanza(peerDeviceJid, 'user_action', callId, callCreator, attrs, [
        { tag: RAISE_HAND_ACTION, attrs: { [RAISE_HAND_STATE_ATTR]: raised ? '1' : '0' } }
    ]);
}
/**
 * Reads the raise-hand state of a `<user_action>` envelope or a standalone `<raise_hand>`;
 * `null` when absent or anything other than `0`/`1`.
 */
export function parseRaiseHandState(node) {
    const stateNode = node.tag === RAISE_HAND_ACTION ? node : findNodeChild(node, RAISE_HAND_ACTION);
    const raw = stateNode?.attrs?.[RAISE_HAND_STATE_ATTR];
    if (raw === '1')
        return true;
    if (raw === '0')
        return false;
    return null;
}
