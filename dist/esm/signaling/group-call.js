import { createNoopLogger } from 'zapo-js';
import { normalizeDeviceJid, toUserJid } from 'zapo-js/protocol';
import { buildReceiptNode } from 'zapo-js/transport';
import { groupParticipantAccountKey } from '../jid.js';
import { resolveOfferParticipantDevices } from '../peer-devices.js';
import { deviceIdentityNode, encryptCallKeyForDevices } from './call-key.js';
import { callStanza, toCallServerJid } from './call-stanza.js';
import { normalizeParticipantDeviceJids } from './group-info.js';
import { buildOfferMediaNodes, CAPABILITY_OFFER, CAPABILITY_VIDEO_OFFER } from './lifecycle.js';
/**
 * The most accounts a group `<offer>`'s `<group_info>` may name, ourselves included.
 *
 * This is the server's group-call participant ceiling, the `group_call_max_participants`
 * AB prop (32 by default), not the 127-entry wire bound on a `<group_info>` element: the
 * server refuses an offer that names more than the call may hold, with `error: '427'` and
 * `error: '412'` on the `<ack>` (`handleCallAck` -> `SetupFailed`). Measured: 32 is
 * accepted, 127 is refused. The official client applies the same gate before placing a
 * group call. Naming fewer is always accepted, so a larger group still starts and the
 * rest joins from the app.
 */
export const WA_GROUP_OFFER_MAX_ACCOUNTS = 32;
function buildGroupUserNode(participant, capability) {
    return {
        tag: 'user',
        attrs: { jid: participant.jid },
        content: participant.devices.map((deviceJid) => ({
            tag: 'device',
            attrs: { jid: normalizeDeviceJid(deviceJid) },
            content: capability
                ? [{ tag: 'capability', attrs: { ver: '1' }, content: capability }]
                : undefined
        }))
    };
}
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
export async function buildGroupOfferStanza(deps, callId, groupJid, participants, isVideo, isLightweight = false, logger) {
    const log = logger ?? createNoopLogger();
    const creds = deps.authClient.getCurrentCredentials();
    const callCreator = creds?.meLid || creds?.meJid || '';
    if (!callCreator) {
        throw new Error('a group call offer has no jid of ours to name as its call-creator');
    }
    const creatorKey = groupParticipantAccountKey(callCreator);
    // Cap BEFORE resolving devices: a group of hundreds would otherwise resolve every
    // device (a fan-out lookup per account) only to drop most of them. The creator takes
    // the first roster slot, so at most `WA_GROUP_OFFER_MAX_ACCOUNTS - 1` others fit.
    const candidates = participants
        .filter((participant) => groupParticipantAccountKey(participant.jid) !== creatorKey)
        .slice(0, WA_GROUP_OFFER_MAX_ACCOUNTS - 1);
    const resolved = await resolveOfferParticipantDevices(deps, candidates, log);
    if (resolved.length === 0) {
        throw new Error(`group call on ${groupJid} has no participant to ring`);
    }
    const creator = {
        jid: toUserJid(callCreator),
        devices: normalizeParticipantDeviceJids(callCreator, [callCreator])
    };
    const listed = [creator];
    const users = [buildGroupUserNode(creator, isVideo ? CAPABILITY_VIDEO_OFFER : CAPABILITY_OFFER)];
    for (const participant of resolved) {
        const entry = {
            jid: toUserJid(participant.jid),
            devices: normalizeParticipantDeviceJids(participant.jid, participant.devices)
        };
        if (listed.length >= WA_GROUP_OFFER_MAX_ACCOUNTS)
            break;
        listed.push(entry);
        users.push(buildGroupUserNode(entry));
    }
    // The offer carries exactly two things that make a voice chat, and nothing else: the
    // `lightweight='1'` marker and the `<silence>` node `buildOfferMediaNodes` adds. Adding
    // further attributes is not free -- an attribute the server does not know makes it drop
    // the offer, and the call is accepted and then never appears.
    //
    // The roster is REQUIRED, voice chat or not: it is the caller's best known device set,
    // and it is what lets the server fan the offer to the participants at all. Omitting it
    // is accepted and then creates nothing. What is capped is its SIZE
    // (`WA_GROUP_OFFER_MAX_ACCOUNTS`): a longer roster is refused with `error: '427'`,
    // which is what kept a group of 128 out (the creator takes a slot).
    return {
        node: callStanza(toCallServerJid(callId), 'offer', callId, callCreator, isLightweight ? { 'group-jid': groupJid, lightweight: '1' } : { 'group-jid': groupJid }, [
            ...buildOfferMediaNodes(isVideo, isLightweight),
            { tag: 'group_info', attrs: {}, content: users }
        ]),
        participants: listed
    };
}
/**
 * Builds the `<enc_rekey>` carrying a new call key to one device: `transaction-id` echoing the
 * `<group_info>` that asked, `<encopt keygen='2'/>`, a direct `<enc>`, `<device-identity>` on a `pkmsg`.
 *
 * @throws when there is no Signal session for the device; a fan-out contains it per device.
 */
export async function buildEncRekeyStanza(deps, params) {
    const { encNodes, shouldIncludeDeviceIdentity } = await encryptCallKeyForDevices(deps, [params.peerDeviceJid], params.callKey);
    const encNode = encNodes[0];
    if (!encNode) {
        throw new Error(`the call key was not encrypted for ${params.peerDeviceJid}`);
    }
    const content = [{ tag: 'encopt', attrs: { keygen: '2' } }, encNode];
    const creds = deps.authClient.getCurrentCredentials();
    if (shouldIncludeDeviceIdentity && creds?.signedIdentity) {
        content.push(deviceIdentityNode(creds.signedIdentity));
    }
    return callStanza(params.peerDeviceJid, 'enc_rekey', params.callId, params.callCreator, { 'transaction-id': String(params.transactionId) }, content);
}
/**
 * Builds the `<call><heartbeat>` every connected member of a group call sends the call itself,
 * every 10 s, whether it answered, placed or joined the call.
 */
export function buildHeartbeatStanza(callId, callCreator) {
    return callStanza(toCallServerJid(callId), 'heartbeat', callId, callCreator);
}
/** The `state` a `<peer_state>` reports for a peer; only `Invisible` has been seen on the wire. */
export const WA_PEER_STATE = Object.freeze({ Invisible: 'invisible', Visible: 'visible' });
/**
 * Builds the `<call><peer_state>` telling the server what this side sees of one group-call member,
 * named by its account (a device suffix is dropped). `Invisible` is a member whose media stopped
 * reaching us; the server takes it off the call. `t` is in epoch milliseconds.
 */
export function buildPeerStateStanza(callId, callCreator, peerAccountJid, state, nowMs = Date.now()) {
    return callStanza(toCallServerJid(callId), 'peer_state', callId, callCreator, { t: String(Math.floor(nowMs)) }, [{ tag: 'user', attrs: { state, jid: toUserJid(peerAccountJid) } }]);
}
/**
 * Builds the `<receipt>` answering an `<enc_rekey>`, sent whether or not its key decrypted;
 * the child names the call, `call-creator` before `call-id`.
 */
export function buildEncRekeyReceiptStanza(peerDeviceJid, rekeyMsgId, callId, callCreator, ourJid) {
    return buildReceiptNode({
        kind: 'custom',
        attrs: { to: peerDeviceJid, id: rekeyMsgId, from: ourJid },
        content: [{ tag: 'enc_rekey', attrs: { 'call-creator': callCreator, 'call-id': callId } }]
    });
}
