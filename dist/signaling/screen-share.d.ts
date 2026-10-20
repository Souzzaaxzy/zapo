import type { BinaryNode } from 'zapo-js/transport';
/**
 * `screenshare_state`. `NotSupported` and `Failed` both close a request without
 * announcing a stream: the peer cannot share at all, or a share did not start.
 */
export declare const WA_SCREEN_SHARE_STATE: Readonly<{
    readonly NotSupported: 0;
    readonly Started: 1;
    readonly Stopped: 2;
    readonly Failed: 3;
}>;
/**
 * `version`: what decides whether a share is a **second** video stream or a replacement
 * for the camera. Up to `V2` the screen is the call's one video stream and the camera is
 * forced off; from `V3` the sharer runs both at once. `Invalid` is negative on purpose -
 * the client's own sentinel for "no version", not a version that can travel.
 */
export declare const WA_SCREEN_SHARE_VERSION: Readonly<{
    readonly Invalid: -1;
    readonly Legacy: 0;
    readonly V1: 1;
    readonly V2: 2;
    readonly V3: 3;
    readonly V4: 4;
}>;
/**
 * The version announced for a share of ours: `V2`, the screen riding the camera's SSRC. A higher
 * version needs its own SSRCs and descriptor, or the peer silently drops the stream.
 */
export declare const WA_SCREEN_SHARE_SEND_VERSION: 2;
/**
 * Screen-share state a peer reported. Every field is independently optional on the wire,
 * so each is `null` when absent, and numbers are kept raw so a `state` or `version` this
 * client does not model yet still reaches the caller.
 */
export interface PeerScreenShare {
    /** `screenshare_state`, one of {@link WA_SCREEN_SHARE_STATE}. */
    readonly state: number | null;
    /** `request-state`: what the peer is *asking* for, not what is in effect. */
    readonly requestState: number | null;
    /** `version`, one of {@link WA_SCREEN_SHARE_VERSION}. */
    readonly version: number | null;
    /** `screen_width` of the shared surface, in pixels. */
    readonly screenWidth: number | null;
    /** `screen_height` of the shared surface, in pixels. */
    readonly screenHeight: number | null;
    /** `device_orientation` of the sharer, 0 to 3. */
    readonly deviceOrientation: number | null;
}
/**
 * Reads the screen-share state out of the payload child of a `<call>` stanza. Both
 * carriers are accepted - `screen_share` negotiates, `screen` adds geometry - and
 * `request-state` under either spelling, because the peer's deserializer takes both.
 * Returns `null` when the node carries neither a state nor a request.
 */
export declare function parseScreenShareNode(node: BinaryNode): PeerScreenShare | null;
/**
 * Builds the `<call><screen_share>` asking the peer to start or stop rendering a share of ours,
 * with no codec or geometry. `screenShareId` counts the starts and stops sent on the call, from 1.
 */
export declare function buildScreenShareStanza(peerDeviceJid: string, callId: string, callCreator: string, screenShareState: number, screenShareId?: number): BinaryNode;
