"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_DEC_H264 = exports.VIDEO_ENC_H264 = exports.WA_VIDEO_UPGRADE_RESULT = exports.WA_VIDEO_UPGRADE_TIMEOUT_MS = exports.WA_VIDEO_STATE = void 0;
exports.buildVideoStateStanza = buildVideoStateStanza;
exports.parseVideoStateNode = parseVideoStateNode;
const util_1 = require("zapo-js/util");
const call_stanza_js_1 = require("./call-stanza.js");
/**
 * `state` of a `<video>` message, written to the wire as this ordinal. Two families share it:
 * announcing the video of a call that has it, and negotiating the upgrade (`6` is `Stopped`).
 */
exports.WA_VIDEO_STATE = Object.freeze({
    Disabled: 0,
    Enabled: 1,
    Paused: 2,
    /** Upgrade request of a **group** call; 1:1 uses {@link UpgradeRequestV2}. */
    UpgradeRequest: 3,
    /** The upgrade is on: the sender is about to put video on the wire. */
    UpgradeAccept: 4,
    /** The peer refused the upgrade; distinct from either side timing out. */
    UpgradeReject: 5,
    Stopped: 6,
    /** The *receiver* of a request never answered it and gave up waiting. */
    UpgradeRejectByTimeout: 7,
    /** The *requester* withdrew its request before it was answered. */
    UpgradeCancel: 8,
    /** The *requester* withdrew its request because its own timer expired. */
    UpgradeCancelByTimeout: 9,
    UnknownPeer: 10,
    /** Upgrade request of a 1:1 call. */
    UpgradeRequestV2: 11,
    Xr2dCodecAvatarEnabled: 12,
    Error: 20
});
/**
 * How long a sent upgrade request waits before the requester gives up. Same value as the
 * peer's own guard timer, so neither side believes in an upgrade the other dropped.
 */
exports.WA_VIDEO_UPGRADE_TIMEOUT_MS = 5000;
/**
 * How an upgrade request this side sent ended. `TimedOut` is the odd one out: this side
 * gave up with nothing coming back, so unlike the others it says nothing about whether
 * the peer ever saw the request.
 */
exports.WA_VIDEO_UPGRADE_RESULT = Object.freeze({
    /** The peer answered `UpgradeAccept`; video may now be sent. */
    Accepted: 'accepted',
    /** The peer answered `UpgradeReject`: it declined. */
    Rejected: 'rejected',
    /** The peer answered `UpgradeRejectByTimeout`: nobody there answered it. */
    RejectedByTimeout: 'rejected_by_timeout',
    /** The peer answered `Error`: it agreed to upgrade and could not. */
    Failed: 'error',
    /** Nothing came back before the guard timer expired. */
    TimedOut: 'timeout',
    /** This side withdrew the request before it was answered. */
    Cancelled: 'cancelled'
});
/** `<video enc>` we uplink and `<video dec>` we decode, in the asymmetric spelling the peer uses. */
exports.VIDEO_ENC_H264 = 'h.264';
exports.VIDEO_DEC_H264 = 'H264';
/** `voip_settings` profile on the two upgrade-request states; without it the peer answers `Error`. */
const WA_VIDEO_UPGRADE_SETTINGS_PROFILE = 'video';
/**
 * Builds the `<call><video>` that announces a video state of our own, covering both
 * halves of the audio-to-video upgrade. `dec` rides on every message, not only the one
 * that concludes it: the peer's parser rejects a `<video>` carrying neither `enc` nor
 * `dec`. On a group call it goes to `<call-id>@call`, where `UpgradeRequest` upgrades the call.
 */
function buildVideoStateStanza(peerDeviceJid, callId, callCreator, options) {
    const attrs = {
        state: String(options.state),
        device_orientation: String(options.deviceOrientation ?? 0),
        dec: options.decoderCodec ?? exports.VIDEO_DEC_H264,
        'transaction-id': String(options.transactionId)
    };
    if (options.state === exports.WA_VIDEO_STATE.UpgradeRequestV2 ||
        options.state === exports.WA_VIDEO_STATE.UpgradeRequest) {
        attrs.voip_settings = WA_VIDEO_UPGRADE_SETTINGS_PROFILE;
    }
    return (0, call_stanza_js_1.callStanza)(peerDeviceJid, 'video', callId, callCreator, attrs);
}
/**
 * Reads the `<video>` the peer sends when its video state changes mid-call, which is also
 * how an audio call is upgraded: there is no separate upgrade stanza. Numbers are passed
 * through raw, see {@link PeerVideoStateChange}. Returns `null` when `state` is missing
 * or unreadable - without it there is no transition to report.
 */
function parseVideoStateNode(innerNode) {
    const state = (0, util_1.tryAsNumber)(innerNode.attrs?.state);
    if (state === null) {
        return null;
    }
    return {
        state,
        transactionId: (0, util_1.tryAsNumber)(innerNode.attrs?.['transaction-id']),
        deviceOrientation: (0, util_1.tryAsNumber)(innerNode.attrs?.device_orientation),
        decoderCodec: innerNode.attrs?.dec || null,
        encoderCodec: innerNode.attrs?.enc || null,
        supportedCodecs: (0, util_1.tryAsNumber)(innerNode.attrs?.enc_supported)
    };
}
