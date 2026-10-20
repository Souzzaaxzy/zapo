import type { BinaryNode } from 'zapo-js/transport';
import type { PeerVideoStateChange } from '../types.js';
/**
 * `state` of a `<video>` message, written to the wire as this ordinal. Two families share it:
 * announcing the video of a call that has it, and negotiating the upgrade (`6` is `Stopped`).
 */
export declare const WA_VIDEO_STATE: Readonly<{
    readonly Disabled: 0;
    readonly Enabled: 1;
    readonly Paused: 2;
    /** Upgrade request of a **group** call; 1:1 uses {@link UpgradeRequestV2}. */
    readonly UpgradeRequest: 3;
    /** The upgrade is on: the sender is about to put video on the wire. */
    readonly UpgradeAccept: 4;
    /** The peer refused the upgrade; distinct from either side timing out. */
    readonly UpgradeReject: 5;
    readonly Stopped: 6;
    /** The *receiver* of a request never answered it and gave up waiting. */
    readonly UpgradeRejectByTimeout: 7;
    /** The *requester* withdrew its request before it was answered. */
    readonly UpgradeCancel: 8;
    /** The *requester* withdrew its request because its own timer expired. */
    readonly UpgradeCancelByTimeout: 9;
    readonly UnknownPeer: 10;
    /** Upgrade request of a 1:1 call. */
    readonly UpgradeRequestV2: 11;
    readonly Xr2dCodecAvatarEnabled: 12;
    readonly Error: 20;
}>;
/**
 * How long a sent upgrade request waits before the requester gives up. Same value as the
 * peer's own guard timer, so neither side believes in an upgrade the other dropped.
 */
export declare const WA_VIDEO_UPGRADE_TIMEOUT_MS = 5000;
/**
 * How an upgrade request this side sent ended. `TimedOut` is the odd one out: this side
 * gave up with nothing coming back, so unlike the others it says nothing about whether
 * the peer ever saw the request.
 */
export declare const WA_VIDEO_UPGRADE_RESULT: Readonly<{
    /** The peer answered `UpgradeAccept`; video may now be sent. */
    readonly Accepted: "accepted";
    /** The peer answered `UpgradeReject`: it declined. */
    readonly Rejected: "rejected";
    /** The peer answered `UpgradeRejectByTimeout`: nobody there answered it. */
    readonly RejectedByTimeout: "rejected_by_timeout";
    /** The peer answered `Error`: it agreed to upgrade and could not. */
    readonly Failed: "error";
    /** Nothing came back before the guard timer expired. */
    readonly TimedOut: "timeout";
    /** This side withdrew the request before it was answered. */
    readonly Cancelled: "cancelled";
}>;
/** One of the values of {@link WA_VIDEO_UPGRADE_RESULT}. */
export type WaVideoUpgradeResult = (typeof WA_VIDEO_UPGRADE_RESULT)[keyof typeof WA_VIDEO_UPGRADE_RESULT];
/** `<video enc>` we uplink and `<video dec>` we decode, in the asymmetric spelling the peer uses. */
export declare const VIDEO_ENC_H264 = "h.264";
export declare const VIDEO_DEC_H264 = "H264";
/** Attributes of a `<video>` this side sends. */
interface VideoStateStanzaOptions {
    /** One of {@link WA_VIDEO_STATE}, written to the wire as it is. */
    readonly state: number;
    /** Our own counter over the video states we have sent, starting at 1. */
    readonly transactionId: number;
    /** `dec`; defaults to H.264. */
    readonly decoderCodec?: string;
    /** `device_orientation`, 0 to 3; defaults to 0, upright. */
    readonly deviceOrientation?: number;
}
/**
 * Builds the `<call><video>` that announces a video state of our own, covering both
 * halves of the audio-to-video upgrade. `dec` rides on every message, not only the one
 * that concludes it: the peer's parser rejects a `<video>` carrying neither `enc` nor
 * `dec`. On a group call it goes to `<call-id>@call`, where `UpgradeRequest` upgrades the call.
 */
export declare function buildVideoStateStanza(peerDeviceJid: string, callId: string, callCreator: string, options: VideoStateStanzaOptions): BinaryNode;
/**
 * Reads the `<video>` the peer sends when its video state changes mid-call, which is also
 * how an audio call is upgraded: there is no separate upgrade stanza. Numbers are passed
 * through raw, see {@link PeerVideoStateChange}. Returns `null` when `state` is missing
 * or unreadable - without it there is no transition to report.
 */
export declare function parseVideoStateNode(innerNode: BinaryNode): PeerVideoStateChange | null;
export {};
