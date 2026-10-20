"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_PEER_STATE = void 0;
exports.buildGroupOfferStanza = buildGroupOfferStanza;
exports.buildEncRekeyStanza = buildEncRekeyStanza;
exports.buildHeartbeatStanza = buildHeartbeatStanza;
exports.buildPeerStateStanza = buildPeerStateStanza;
exports.buildEncRekeyReceiptStanza = buildEncRekeyReceiptStanza;
const zapo_js_1 = require("zapo-js");
const protocol_1 = require("zapo-js/protocol");
const transport_1 = require("zapo-js/transport");
const jid_js_1 = require("../jid.js");
const peer_devices_js_1 = require("../peer-devices.js");
const call_key_js_1 = require("./call-key.js");
const call_stanza_js_1 = require("./call-stanza.js");
const group_info_js_1 = require("./group-info.js");
const lifecycle_js_1 = require("./lifecycle.js");
function buildGroupUserNode(participant, capability) {
    return {
        tag: 'user',
        attrs: { jid: participant.jid },
        content: participant.devices.map((deviceJid) => ({
            tag: 'device',
            attrs: { jid: (0, protocol_1.normalizeDeviceJid)(deviceJid) },
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
async function buildGroupOfferStanza(deps, callId, groupJid, participants, isVideo, isLightweight = false, logger) {
    const log = logger ?? (0, zapo_js_1.createNoopLogger)();
    const creds = deps.authClient.getCurrentCredentials();
    const callCreator = creds?.meLid || creds?.meJid || '';
    if (!callCreator) {
        throw new Error('a group call offer has no jid of ours to name as its call-creator');
    }
    const creatorKey = (0, jid_js_1.groupParticipantAccountKey)(callCreator);
    const resolved = await (0, peer_devices_js_1.resolveOfferParticipantDevices)(deps, participants.filter((participant) => (0, jid_js_1.groupParticipantAccountKey)(participant.jid) !== creatorKey), log);
    if (resolved.length === 0) {
        throw new Error(`group call on ${groupJid} has no participant to ring`);
    }
    const creator = {
        jid: (0, protocol_1.toUserJid)(callCreator),
        devices: (0, group_info_js_1.normalizeParticipantDeviceJids)(callCreator, [callCreator])
    };
    const listed = [creator];
    const users = [buildGroupUserNode(creator, isVideo ? lifecycle_js_1.CAPABILITY_VIDEO_OFFER : lifecycle_js_1.CAPABILITY_OFFER)];
    for (const participant of resolved) {
        const entry = {
            jid: (0, protocol_1.toUserJid)(participant.jid),
            devices: (0, group_info_js_1.normalizeParticipantDeviceJids)(participant.jid, participant.devices)
        };
        listed.push(entry);
        users.push(buildGroupUserNode(entry));
    }
    return {
        node: (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.toCallServerJid)(callId), 'offer', callId, callCreator, isLightweight ? { 'group-jid': groupJid, lightweight: '1' } : { 'group-jid': groupJid }, [
            ...(0, lifecycle_js_1.buildOfferMediaNodes)(isVideo, isLightweight),
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
async function buildEncRekeyStanza(deps, params) {
    const { encNodes, shouldIncludeDeviceIdentity } = await (0, call_key_js_1.encryptCallKeyForDevices)(deps, [params.peerDeviceJid], params.callKey);
    const encNode = encNodes[0];
    if (!encNode) {
        throw new Error(`the call key was not encrypted for ${params.peerDeviceJid}`);
    }
    const content = [{ tag: 'encopt', attrs: { keygen: '2' } }, encNode];
    const creds = deps.authClient.getCurrentCredentials();
    if (shouldIncludeDeviceIdentity && creds?.signedIdentity) {
        content.push((0, call_key_js_1.deviceIdentityNode)(creds.signedIdentity));
    }
    return (0, call_stanza_js_1.callStanza)(params.peerDeviceJid, 'enc_rekey', params.callId, params.callCreator, { 'transaction-id': String(params.transactionId) }, content);
}
/**
 * Builds the `<call><heartbeat>` every connected member of a group call sends the call itself,
 * every 10 s, whether it answered, placed or joined the call.
 */
function buildHeartbeatStanza(callId, callCreator) {
    return (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.toCallServerJid)(callId), 'heartbeat', callId, callCreator);
}
/** The `state` a `<peer_state>` reports for a peer; only `Invisible` has been seen on the wire. */
exports.WA_PEER_STATE = Object.freeze({ Invisible: 'invisible', Visible: 'visible' });
/**
 * Builds the `<call><peer_state>` telling the server what this side sees of one group-call member,
 * named by its account (a device suffix is dropped). `Invisible` is a member whose media stopped
 * reaching us; the server takes it off the call. `t` is in epoch milliseconds.
 */
function buildPeerStateStanza(callId, callCreator, peerAccountJid, state, nowMs = Date.now()) {
    return (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.toCallServerJid)(callId), 'peer_state', callId, callCreator, { t: String(Math.floor(nowMs)) }, [{ tag: 'user', attrs: { state, jid: (0, protocol_1.toUserJid)(peerAccountJid) } }]);
}
/**
 * Builds the `<receipt>` answering an `<enc_rekey>`, sent whether or not its key decrypted;
 * the child names the call, `call-creator` before `call-id`.
 */
function buildEncRekeyReceiptStanza(peerDeviceJid, rekeyMsgId, callId, callCreator, ourJid) {
    return (0, transport_1.buildReceiptNode)({
        kind: 'custom',
        attrs: { to: peerDeviceJid, id: rekeyMsgId, from: ourJid },
        content: [{ tag: 'enc_rekey', attrs: { 'call-creator': callCreator, 'call-id': callId } }]
    });
}
