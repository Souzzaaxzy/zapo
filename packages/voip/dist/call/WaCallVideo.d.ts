import type { Logger } from 'zapo-js';
import type { WaCallMediaVideo } from '@zapo-js/voip-media';
import { type WaVideoUpgradeResult } from '../signaling/video-state.js';
import type { CallInfo } from './call-state.js';
import type { WaCallPlanPublisher } from './WaCallPlanPublisher.js';
import type { WaCallStanzaSender } from './WaCallStanzaSender.js';
import { type PeerVideoReadyTrigger } from './WaPeerVideoReadyGate.js';
export interface WaCallVideoOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly stanzas: WaCallStanzaSender;
    readonly plan: WaCallPlanPublisher;
    readonly delegate: {
        emitState(call: CallInfo): void;
    };
    /** Where our `<video>` goes. */
    readonly target: () => string;
    /** The receive path just opened: the peer's video streams are to be subscribed. */
    readonly onReceivePathOpened: () => void;
    /** Clock of the peer-ready hold; its own default when absent. */
    readonly now?: () => number;
}
/** One call's video: our send and receive paths, the peer-ready hold, the upgrade handshake. */
export declare class WaCallVideo {
    private readonly info;
    private readonly logger;
    private readonly stanzas;
    private readonly plan;
    private readonly delegate;
    private readonly target;
    private readonly onReceivePathOpened;
    /** Whether {@link ensureReceivePath} ran; a call negotiated as video never sets it. */
    private videoReceivePathOpened;
    /** Whether an accepted upgrade opened our video sender on a call negotiated as audio. */
    private videoSendPathOpened;
    /** Holds our video until the peer can take it; published as `video.sendHeld`. */
    private readonly peerVideoReadyGate;
    /** Our counter behind `transaction-id` on the `<video>` we send; the first one is 1. */
    private videoStateTransactionId;
    /** The upgrade request this side sent and is still waiting on, or `null`. */
    private pendingVideoUpgrade;
    /** Whether the peer has an upgrade request outstanding against us. */
    private peerVideoUpgradeRequested;
    /** Counts the peer's `<video>` acted on, so a failed answer can tell whether it raced one. */
    private peerVideoStateSeen;
    /** Whether our camera is on in a group call; `null` follows the call's media type. */
    private groupVideoSend;
    /** Whether the server's `<av_upgrade>` turned this group call into a video call. */
    private groupVideoUpgraded;
    constructor(options: WaCallVideoOptions);
    /** Whether every group sender's video gets keyed: a video call, or video receiving opened. */
    get coversVideo(): boolean;
    get sendActive(): boolean;
    get groupSending(): boolean;
    /** Whether an upgrade request of ours is still unanswered. */
    get upgradePending(): boolean;
    /**
     * What video may flow each way; a media host reads this, not the media type, to capture.
     * `sendHeld` is present only while the peer is not ready for our video.
     */
    section(): WaCallMediaVideo;
    /** Holds our video from the accept of a born-video call; published before media can flow. */
    holdBornVideoSend(): void;
    /** The peer gave `trigger`'s sign that it can take our video. */
    markPeerReady(trigger: PeerVideoReadyTrigger): void;
    /**
     * Opens the video receive path on a call negotiated as audio: the peer's video streams and
     * the RTP session its key frame requests ride on. Our sender stays off. Idempotent.
     */
    ensureReceivePath(): void;
    /** A `<video>` of the 1:1 peer was acted on: the receive path opens, the handshake moves. */
    onPeerVideoState(state: number): void;
    /** Marks this group call upgraded; `false` when it already was. */
    claimGroupUpgrade(): boolean;
    /**
     * The group call turned video: the camera goes on when we `asked`, else a camera not
     * turned on is announced as stopped.
     */
    applyGroupUpgrade(asked: boolean): void;
    /**
     * Turns our camera on or off on a group call; a 1:1 call uses {@link requestUpgrade}.
     * @throws on a 1:1 call, or when the send fails, leaving the camera as it was.
     */
    setGroupEnabled(enabled: boolean): Promise<void>;
    /**
     * Asks the peer to turn this audio call into video, resolving with the outcome; no video
     * leaves until it accepts. A crossing request is answered instead, a second call joins the
     * first. @throws when the call is not active or already carries video.
     */
    requestUpgrade(): Promise<WaVideoUpgradeResult>;
    /**
     * Accepts the peer's upgrade request: the accept, then our sender, then `Enabled`, our frames
     * held by {@link WaPeerVideoReadyGate}. No-op when the peer has nothing outstanding.
     */
    acceptUpgrade(): Promise<void>;
    /** Declines an upgrade the peer asked for. No-op when it asked for none. */
    rejectUpgrade(): Promise<void>;
    /** Withdraws the request this side sent. No-op when nothing is in flight. */
    cancelUpgrade(): Promise<void>;
    /** Settles what waits on a handshake and lets go of every path and hold: the call is over. */
    reset(): void;
    private applyGroupVideoSend;
    /**
     * Asks the server to turn a group audio call into a video call: `UpgradeRequest` to the
     * call. Resolves `accepted` once its `<av_upgrade>` arrives, our camera then on, or
     * `timeout`. On a call already carrying video it only turns our camera on.
     */
    private requestGroupVideoUpgrade;
    /**
     * Moves the upgrade handshake on the peer's state: a request is only recorded, a terminal
     * code settles ours. Every code but `Enabled` clears the peer's outstanding request.
     */
    private applyPeerUpgradeState;
    /** Puts back the peer request an answer that never left cleared, unless the peer spoke since. */
    private restorePeerRequest;
    /**
     * Ends a request the peer never answered, the call staying audio. The withdrawal is
     * `Disabled`, not `UpgradeCancelByTimeout`: the cancel codes are a deliberate withdrawal.
     */
    private onVideoUpgradeTimeout;
    /** Settles and drops the request in flight; every path ending a handshake comes here. */
    private settleVideoUpgrade;
    /** Sends one `<video>`, numbered by our own counter, never by an id the peer sent. */
    private sendVideoState;
    /** {@link sendVideoState} for a caller that does not wait: the failure is already logged. */
    private sendVideoStateDetached;
    /**
     * Opens our video sender on a call negotiated as audio, once the upgrade is agreed; unlike
     * {@link ensureReceivePath}, which any sign of peer video opens. Idempotent.
     */
    private openVideoSendPath;
    /** Records our video as live, the one part a call negotiated as video also needs. */
    private announceVideoLive;
    /** Lets our held video go, the gate having opened: the peer is ready, or never said so. */
    private releaseVideoSend;
}
