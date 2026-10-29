"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_PEER_STATE = exports.WA_GROUP_OFFER_MAX_ACCOUNTS = void 0;
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
const phash_js_1 = require("./phash.js");
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
exports.WA_GROUP_OFFER_MAX_ACCOUNTS = 32;
/**
 * The participant-set hash (`2:<base64>`) of a group's resolved device set, or `null` when
 * there is nothing to hash.
 *
 * <p>Every device of every participant goes into the hash -- that is the whole point: it
 * stands in for the list we cannot write. The participants' own jids are added when a
 * member resolved to no device, so a member is never silently dropped from the set.
 *
 * <p>Our own device is added too. The reference hashes `phashV2([].concat(A, [B]))`, where
 * `A` is the resolved recipient set and `B` the sending device: the device that places the
 * call is part of the set, and the server recomputes the same string to validate it.
 * Confirmed against the reference vectors (`2:rZoSAdIV` without it, `2:sti8OtHX` with it).
 */
function phashOfGroup(resolved, ownDeviceJid) {
    const devices = new Set();
    for (const participant of resolved) {
        if (participant.devices.length === 0) {
            devices.add((0, jid_js_1.toDeviceJid)(participant.jid));
            continue;
        }
        for (const device of participant.devices)
            devices.add(device);
    }
    devices.add(ownDeviceJid);
    if (devices.size === 0)
        return null;
    return (0, phash_js_1.computePhashV2)([...devices]);
}
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
    const others = participants.filter((participant) => (0, jid_js_1.groupParticipantAccountKey)(participant.jid) !== creatorKey);
    // A group that does not fit the call ceiling cannot be NAMED: a roster shorter than the
    // group is refused (`412`/`427`) and an offer naming nobody is dropped in silence (no
    // ack at all). The official client references such a set by its HASH instead -- a
    // `<group_info phash="2:...">` with no `<user>` children -- and the server resolves it
    // against the group, so the ceiling stops applying to the OFFER: the call is placed
    // against the whole group and whoever wants to join does so from the app.
    //
    // The hash path is taken by ANY overflowing group, ringing call or voice chat: the
    // hash is how a set too large to write is referenced, and a ringing call needs it just
    // as much as a voice chat does (naming 32 of a 400-member group is what gets refused).
    // Capping BEFORE resolving devices keeps a group of hundreds from resolving every
    // device only to drop most: the hash only needs the devices, not the account split.
    const overflows = others.length > exports.WA_GROUP_OFFER_MAX_ACCOUNTS - 1;
    const candidates = overflows ? others : others.slice(0, exports.WA_GROUP_OFFER_MAX_ACCOUNTS - 1);
    const resolved = await (0, peer_devices_js_1.resolveOfferParticipantDevices)(deps, candidates, log);
    if (resolved.length === 0 && !overflows) {
        throw new Error(`group call on ${groupJid} has no participant to ring`);
    }
    const creator = {
        jid: (0, protocol_1.toUserJid)(callCreator),
        devices: (0, group_info_js_1.normalizeParticipantDeviceJids)(callCreator, [callCreator])
    };
    const listed = [creator];
    const users = [buildGroupUserNode(creator, isVideo ? lifecycle_js_1.CAPABILITY_VIDEO_OFFER : lifecycle_js_1.CAPABILITY_OFFER)];
    if (!overflows) {
        for (const participant of resolved) {
            const entry = {
                jid: (0, protocol_1.toUserJid)(participant.jid),
                devices: (0, group_info_js_1.normalizeParticipantDeviceJids)(participant.jid, participant.devices)
            };
            if (listed.length >= exports.WA_GROUP_OFFER_MAX_ACCOUNTS)
                break;
            listed.push(entry);
            users.push(buildGroupUserNode(entry));
        }
    }
    // The offer carries exactly two things that make a voice chat, and nothing else: the
    // `lightweight='1'` marker and the `<silence>` node `buildOfferMediaNodes` adds. Adding
    // further attributes is not free -- an attribute the server does not know makes it drop
    // the offer, and the call is accepted and then never appears.
    //
    // The roster is REQUIRED, voice chat or not: it is the caller's best known device set,
    // and it is what lets the server fan the offer to the participants at all. Omitting it
    // is accepted and then creates nothing. What changes is its SHAPE: an enumerated
    // `<group_info>` when the group fits (`WA_GROUP_OFFER_MAX_ACCOUNTS`; a longer roster is
    // refused with `error: '427'`), or the participant-set HASH when it does not.
    const offerContent = (0, lifecycle_js_1.buildOfferMediaNodes)(isVideo, isLightweight);
    if (overflows) {
        // No participant resolved to a device means there is no set to hash; the enumerated
        // path would have thrown, so keep the offer well formed by omitting the roster.
        const phash = phashOfGroup(resolved, (0, jid_js_1.toDeviceJid)(callCreator));
        if (phash !== null) {
            offerContent.push({ tag: 'group_info', attrs: { phash }, content: undefined });
        }
    }
    else {
        offerContent.push({ tag: 'group_info', attrs: {}, content: users });
    }
    return {
        node: (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.toCallServerJid)(callId), 'offer', callId, callCreator, isLightweight ? { 'group-jid': groupJid, lightweight: '1' } : { 'group-jid': groupJid }, offerContent),
        participants: listed,
        hashOnly: overflows
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
