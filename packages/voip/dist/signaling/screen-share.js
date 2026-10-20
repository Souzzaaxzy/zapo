"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_SCREEN_SHARE_SEND_VERSION = exports.WA_SCREEN_SHARE_VERSION = exports.WA_SCREEN_SHARE_STATE = void 0;
exports.parseScreenShareNode = parseScreenShareNode;
exports.buildScreenShareStanza = buildScreenShareStanza;
const util_1 = require("zapo-js/util");
const call_stanza_js_1 = require("./call-stanza.js");
/**
 * `screenshare_state`. `NotSupported` and `Failed` both close a request without
 * announcing a stream: the peer cannot share at all, or a share did not start.
 */
exports.WA_SCREEN_SHARE_STATE = Object.freeze({
    NotSupported: 0,
    Started: 1,
    Stopped: 2,
    Failed: 3
});
/**
 * `version`: what decides whether a share is a **second** video stream or a replacement
 * for the camera. Up to `V2` the screen is the call's one video stream and the camera is
 * forced off; from `V3` the sharer runs both at once. `Invalid` is negative on purpose -
 * the client's own sentinel for "no version", not a version that can travel.
 */
exports.WA_SCREEN_SHARE_VERSION = Object.freeze({
    Invalid: -1,
    Legacy: 0,
    V1: 1,
    V2: 2,
    V3: 3,
    V4: 4
});
/**
 * The version announced for a share of ours: `V2`, the screen riding the camera's SSRC. A higher
 * version needs its own SSRCs and descriptor, or the peer silently drops the stream.
 */
exports.WA_SCREEN_SHARE_SEND_VERSION = exports.WA_SCREEN_SHARE_VERSION.V2;
/**
 * Reads the screen-share state out of the payload child of a `<call>` stanza. Both
 * carriers are accepted - `screen_share` negotiates, `screen` adds geometry - and
 * `request-state` under either spelling, because the peer's deserializer takes both.
 * Returns `null` when the node carries neither a state nor a request.
 */
function parseScreenShareNode(node) {
    const attrs = node.attrs ?? {};
    const state = (0, util_1.tryAsNumber)(attrs.screenshare_state);
    const requestState = (0, util_1.tryAsNumber)(attrs['request-state'] ?? attrs.request_state);
    if (state === null && requestState === null)
        return null;
    return {
        state,
        requestState,
        version: (0, util_1.tryAsNumber)(attrs.version),
        screenWidth: (0, util_1.tryAsNumber)(attrs.screen_width),
        screenHeight: (0, util_1.tryAsNumber)(attrs.screen_height),
        deviceOrientation: (0, util_1.tryAsNumber)(attrs.device_orientation)
    };
}
/**
 * Builds the `<call><screen_share>` asking the peer to start or stop rendering a share of ours,
 * with no codec or geometry. `screenShareId` counts the starts and stops sent on the call, from 1.
 */
function buildScreenShareStanza(peerDeviceJid, callId, callCreator, screenShareState, screenShareId) {
    const attrs = {
        screenshare_state: String(screenShareState),
        version: String(exports.WA_SCREEN_SHARE_SEND_VERSION)
    };
    if (screenShareId !== undefined)
        attrs.screen_share_id = String(screenShareId);
    return (0, call_stanza_js_1.callStanza)(peerDeviceJid, 'screen_share', callId, callCreator, attrs);
}
