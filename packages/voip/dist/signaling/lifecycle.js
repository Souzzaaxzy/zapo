"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_VIDEO_OFFER = exports.CAPABILITY_OFFER = void 0;
exports.parseJoinableAttr = parseJoinableAttr;
exports.parseGroupJidAttr = parseGroupJidAttr;
exports.parseReRingAttr = parseReRingAttr;
exports.buildOfferMediaNodes = buildOfferMediaNodes;
exports.buildOfferStanza = buildOfferStanza;
exports.buildAcceptStanza = buildAcceptStanza;
exports.buildTerminateStanza = buildTerminateStanza;
exports.buildRejectStanza = buildRejectStanza;
exports.buildPreacceptStanza = buildPreacceptStanza;
exports.buildAcceptReceiptStanza = buildAcceptReceiptStanza;
exports.needsDecryption = needsDecryption;
const zapo_js_1 = require("zapo-js");
const protocol_1 = require("zapo-js/protocol");
const transport_1 = require("zapo-js/transport");
const util_1 = require("zapo-js/util");
const call_key_js_1 = require("./call-key.js");
const call_stanza_js_1 = require("./call-stanza.js");
const video_state_js_1 = require("./video-state.js");
/** `joinable` of an `<offer>`: whether others may still join. Says nothing about group-ness. */
function parseJoinableAttr(innerNode) {
    const raw = innerNode.attrs?.joinable;
    return raw === '1' || raw === 'true';
}
/** `group-jid` of an `<offer>`, in either spelling, or `null` on a call that is no group's. */
function parseGroupJidAttr(innerNode) {
    const raw = innerNode.attrs?.['group-jid'] ?? innerNode.attrs?.group_jid;
    return raw ? raw : null;
}
/** `re-ring='1'` of an `<offer>`: a call already going rings this side again, with no `<relay>`. */
function parseReRingAttr(innerNode) {
    return innerNode.attrs?.['re-ring'] === '1';
}
/**
 * Version, mask length, then a 40-bit mask read LSB-first. Neither blob sets bit 36
 * (`enable_mlow_red`, `0x10` of the last byte) nor 38 (`enable_mlow_separate_pt_tx`, `0x40`): a peer
 * that sees them may send RED this side cannot fully unwrap, in-band or on its own payload type.
 */
exports.CAPABILITY_OFFER = new Uint8Array([0x01, 0x05, 0xf7, 0x09, 0xe4, 0xbb, 0x07]);
exports.CAPABILITY_VIDEO_OFFER = new Uint8Array([0x01, 0x05, 0xf7, 0x09, 0xe0, 0xfa, 0x03]);
const CAPABILITY_PREACCEPT = new Uint8Array([0x01, 0x05, 0xff, 0x09, 0xe4, 0xbb, 0x07]);
/**
 * The media an offer announces, 1:1 or group: the two opus rates, video when asked, `<net>`.
 *
 * `isLightweight` marks a group call as a voice chat, which announces `<silence>` instead of
 * media: it never rings and nobody speaks until a member joins. Measured against WhatsApp Web,
 * a voice chat offer differs from a plain one by the `lightweight` attribute plus this node.
 */
function buildOfferMediaNodes(isVideo, isLightweight = false) {
    const nodes = [
        { tag: 'audio', attrs: { enc: 'opus', rate: '8000' }, content: undefined },
        { tag: 'audio', attrs: { enc: 'opus', rate: '16000' }, content: undefined }
    ];
    if (isLightweight) {
        nodes.push({ tag: 'silence', attrs: { reason: 'lightweight' }, content: undefined });
    }
    if (isVideo) {
        nodes.push({
            tag: 'video',
            attrs: {
                enc: video_state_js_1.VIDEO_ENC_H264,
                dec: video_state_js_1.VIDEO_DEC_H264,
                screen_width: '1920',
                screen_height: '1080',
                device_orientation: '0'
            },
            content: undefined
        });
    }
    nodes.push({ tag: 'net', attrs: { medium: '3' }, content: undefined });
    return nodes;
}
async function buildOfferStanza(deps, stores, callId, callKey, peerJid, isVideo, logger) {
    const log = logger ?? (0, zapo_js_1.createNoopLogger)();
    const creds = deps.authClient.getCurrentCredentials();
    const callCreator = creds?.meLid || creds?.meJid || '';
    const synced = await deps.signalDeviceSync.syncDeviceList([peerJid]);
    const devices = synced.flatMap((entry) => entry.deviceJids);
    if (devices.length === 0) {
        throw new Error(`no device sessions to encrypt the call offer for ${peerJid}`);
    }
    const { encNodes, shouldIncludeDeviceIdentity } = await (0, call_key_js_1.encryptCallKeyForDevices)(deps, devices, callKey);
    const destinations = devices.map((jid, index) => ({
        tag: 'to',
        attrs: { jid },
        content: [encNodes[index]]
    }));
    const offerContent = [];
    try {
        const peerJidNormalized = (0, protocol_1.toUserJid)(peerJid);
        const tcTokenRecord = await stores.privacyToken.getByJid(peerJidNormalized);
        const tctoken = tcTokenRecord?.tcToken;
        if (tctoken) {
            offerContent.push({
                tag: 'privacy',
                attrs: {},
                content: tctoken instanceof Uint8Array ? tctoken : new Uint8Array(tctoken)
            });
        }
    }
    catch (err) {
        log.trace('tctoken lookup failed', { message: (0, util_1.toError)(err).message });
    }
    offerContent.push(...buildOfferMediaNodes(isVideo));
    offerContent.push({
        tag: 'capability',
        attrs: { ver: '1' },
        content: isVideo ? exports.CAPABILITY_VIDEO_OFFER : exports.CAPABILITY_OFFER
    });
    offerContent.push({ tag: 'destination', attrs: {}, content: destinations });
    offerContent.push({
        tag: 'encopt',
        attrs: { keygen: '2' },
        content: undefined
    });
    if (shouldIncludeDeviceIdentity && creds?.signedIdentity) {
        offerContent.push((0, call_key_js_1.deviceIdentityNode)(creds.signedIdentity));
    }
    return (0, call_stanza_js_1.callStanza)(peerJid, 'offer', callId, callCreator, undefined, offerContent);
}
/**
 * Builds the `<call><accept>`: no `<enc>` or `<device-identity>` (the server drops an accept
 * carrying `<enc>`), `<encopt>` only on a group accept, which goes to `<call-id>@call`; a 1:1
 * accept goes to the caller device verbatim. Video answers `enc='h.264' dec='H264'`.
 */
async function buildAcceptStanza(deps, callId, peerJid, callCreator, isVideo, isGroupCall = false) {
    await deps.messageDispatch.syncSignalSession(callCreator);
    const acceptContent = [
        { tag: 'audio', attrs: { enc: 'opus', rate: '16000' } },
        { tag: 'net', attrs: { medium: '3' } }
    ];
    if (isVideo) {
        acceptContent.push({ tag: 'video', attrs: { enc: video_state_js_1.VIDEO_ENC_H264, dec: video_state_js_1.VIDEO_DEC_H264 } });
    }
    if (isGroupCall) {
        acceptContent.push({ tag: 'encopt', attrs: { keygen: '2' } });
    }
    return (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.callTarget)(peerJid, callId, isGroupCall), 'accept', callId, callCreator, undefined, acceptContent);
}
function buildTerminateStanza(peerJid, callId, callCreator, audioDurationMs, reason) {
    const attrs = {};
    if (audioDurationMs !== undefined && audioDurationMs >= 0) {
        const ms = String(Math.floor(audioDurationMs));
        attrs.duration = ms;
        attrs.audio_duration = ms;
    }
    if (reason !== undefined) {
        attrs.reason = reason;
    }
    return (0, call_stanza_js_1.callStanza)(peerJid, 'terminate', callId, callCreator, attrs);
}
/**
 * The reject goes to the device that sent the offer (a bare user never reaches a companion), or
 * to `<call-id>@call` with `count='0'` on a group call, so the others stop listing us as ringing.
 */
function buildRejectStanza(peerJid, callId, callCreator, isGroupCall = false) {
    return (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.callTarget)(peerJid, callId, isGroupCall), 'reject', callId, callCreator, isGroupCall ? { count: '0' } : undefined);
}
/** A group preaccept (`isGroupCall`) carries the same children, addressed to `<call-id>@call`. */
function buildPreacceptStanza(peerJid, callId, callCreator, isGroupCall = false) {
    return (0, call_stanza_js_1.callStanza)((0, call_stanza_js_1.callTarget)(peerJid, callId, isGroupCall), 'preaccept', callId, callCreator, undefined, [
        { tag: 'audio', attrs: { enc: 'opus', rate: '16000' } },
        { tag: 'encopt', attrs: { keygen: '2' } },
        { tag: 'capability', attrs: { ver: '1' }, content: CAPABILITY_PREACCEPT }
    ]);
}
function buildAcceptReceiptStanza(peerDeviceJid, acceptMsgId, callId, callCreator, ourJid) {
    return (0, transport_1.buildReceiptNode)({
        kind: 'custom',
        attrs: { to: peerDeviceJid, id: acceptMsgId, from: ourJid },
        content: [{ tag: 'accept', attrs: { 'call-id': callId, 'call-creator': callCreator } }]
    });
}
function needsDecryption(tag) {
    return tag === 'preaccept' || tag === 'accept';
}
