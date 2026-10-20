"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaCallVideo = void 0;
const util_1 = require("zapo-js/util");
const video_state_js_1 = require("../signaling/video-state.js");
const types_js_1 = require("../types.js");
const WaPeerVideoReadyGate_js_1 = require("./WaPeerVideoReadyGate.js");
/** One call's video: our send and receive paths, the peer-ready hold, the upgrade handshake. */
class WaCallVideo {
    constructor(options) {
        /** Whether {@link ensureReceivePath} ran; a call negotiated as video never sets it. */
        this.videoReceivePathOpened = false;
        /** Whether an accepted upgrade opened our video sender on a call negotiated as audio. */
        this.videoSendPathOpened = false;
        /** Our counter behind `transaction-id` on the `<video>` we send; the first one is 1. */
        this.videoStateTransactionId = 0;
        /** The upgrade request this side sent and is still waiting on, or `null`. */
        this.pendingVideoUpgrade = null;
        /** Whether the peer has an upgrade request outstanding against us. */
        this.peerVideoUpgradeRequested = false;
        /** Counts the peer's `<video>` acted on, so a failed answer can tell whether it raced one. */
        this.peerVideoStateSeen = 0;
        /** Whether our camera is on in a group call; `null` follows the call's media type. */
        this.groupVideoSend = null;
        /** Whether the server's `<av_upgrade>` turned this group call into a video call. */
        this.groupVideoUpgraded = false;
        this.info = options.info;
        this.logger = options.logger;
        this.stanzas = options.stanzas;
        this.plan = options.plan;
        this.delegate = options.delegate;
        this.target = options.target;
        this.onReceivePathOpened = options.onReceivePathOpened;
        this.peerVideoReadyGate = new WaPeerVideoReadyGate_js_1.WaPeerVideoReadyGate((reason, trigger, heldMs) => this.releaseVideoSend(reason, trigger, heldMs), options.now);
    }
    /** Whether every group sender's video gets keyed: a video call, or video receiving opened. */
    get coversVideo() {
        return this.info.mediaType === types_js_1.CallMediaType.Video || this.videoReceivePathOpened;
    }
    get sendActive() {
        if (this.info.isGroupCall)
            return this.groupSending;
        return this.info.mediaType === types_js_1.CallMediaType.Video || this.videoSendPathOpened;
    }
    get groupSending() {
        return this.groupVideoSend ?? this.info.mediaType === types_js_1.CallMediaType.Video;
    }
    /** Whether an upgrade request of ours is still unanswered. */
    get upgradePending() {
        return this.pendingVideoUpgrade !== null;
    }
    /**
     * What video may flow each way; a media host reads this, not the media type, to capture.
     * `sendHeld` is present only while the peer is not ready for our video.
     */
    section() {
        const videoCall = this.info.mediaType === types_js_1.CallMediaType.Video;
        const send = this.info.isGroupCall && this.groupVideoSend !== null
            ? this.groupVideoSend
            : videoCall || this.videoSendPathOpened;
        return {
            send,
            receive: videoCall || this.videoReceivePathOpened,
            ...(this.peerVideoReadyGate.isHeld && { sendHeld: true })
        };
    }
    /** Holds our video from the accept of a born-video call; published before media can flow. */
    holdBornVideoSend() {
        this.peerVideoReadyGate.hold('born-video');
        void this.plan.publish({ video: this.section() });
    }
    /** The peer gave `trigger`'s sign that it can take our video. */
    markPeerReady(trigger) {
        this.peerVideoReadyGate.markPeerReady(trigger);
    }
    /**
     * Opens the video receive path on a call negotiated as audio: the peer's video streams and
     * the RTP session its key frame requests ride on. Our sender stays off. Idempotent.
     */
    ensureReceivePath() {
        if (this.videoReceivePathOpened || this.info.mediaType === types_js_1.CallMediaType.Video)
            return;
        this.videoReceivePathOpened = true;
        this.onReceivePathOpened();
    }
    /** A `<video>` of the 1:1 peer was acted on: the receive path opens, the handshake moves. */
    onPeerVideoState(state) {
        this.peerVideoStateSeen++;
        this.ensureReceivePath();
        this.applyPeerUpgradeState(state);
    }
    /** Marks this group call upgraded; `false` when it already was. */
    claimGroupUpgrade() {
        if (this.groupVideoUpgraded)
            return false;
        this.groupVideoUpgraded = true;
        return true;
    }
    /**
     * The group call turned video: the camera goes on when we `asked`, else a camera not
     * turned on is announced as stopped.
     */
    applyGroupUpgrade(asked) {
        if (asked) {
            this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Accepted);
            this.applyGroupVideoSend(true);
        }
        else if (this.groupVideoSend !== true) {
            this.groupVideoSend = false;
            void this.plan.publish({ video: this.section() });
            this.sendVideoStateDetached(video_state_js_1.WA_VIDEO_STATE.Stopped);
        }
    }
    /**
     * Turns our camera on or off on a group call; a 1:1 call uses {@link requestUpgrade}.
     * @throws on a 1:1 call, or when the send fails, leaving the camera as it was.
     */
    async setGroupEnabled(enabled) {
        if (!this.info.isGroupCall) {
            throw new Error(`Call ${this.info.callId} is not a group call; request an upgrade`);
        }
        if (!this.info.isActive || this.groupSending === enabled)
            return;
        await this.sendVideoState(enabled ? video_state_js_1.WA_VIDEO_STATE.Enabled : video_state_js_1.WA_VIDEO_STATE.Stopped);
        this.applyGroupVideoSend(enabled);
    }
    /**
     * Asks the peer to turn this audio call into video, resolving with the outcome; no video
     * leaves until it accepts. A crossing request is answered instead, a second call joins the
     * first. @throws when the call is not active or already carries video.
     */
    async requestUpgrade() {
        if (this.info.isGroupCall)
            return this.requestGroupVideoUpgrade();
        if (!this.info.isActive) {
            throw new Error(`Call ${this.info.callId} is not active`);
        }
        if (this.sendActive) {
            throw new Error(`Call ${this.info.callId} already carries video`);
        }
        if (this.pendingVideoUpgrade) {
            return this.pendingVideoUpgrade.promise;
        }
        if (this.peerVideoUpgradeRequested) {
            await this.acceptUpgrade();
            return video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Accepted;
        }
        let settle;
        const promise = new Promise((resolve) => {
            settle = resolve;
        });
        const timer = setTimeout(() => {
            this.onVideoUpgradeTimeout();
        }, video_state_js_1.WA_VIDEO_UPGRADE_TIMEOUT_MS);
        timer.unref?.();
        // Armed before the request leaves: the peer can answer while the send still unwinds.
        this.pendingVideoUpgrade = { timer, settle, promise };
        try {
            await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.UpgradeRequestV2);
        }
        catch (err) {
            this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Failed);
            throw err;
        }
        this.logger.debug('video upgrade requested', {
            callId: this.info.callId,
            timeoutMs: video_state_js_1.WA_VIDEO_UPGRADE_TIMEOUT_MS
        });
        return promise;
    }
    /**
     * Accepts the peer's upgrade request: the accept, then our sender, then `Enabled`, our frames
     * held by {@link WaPeerVideoReadyGate}. No-op when the peer has nothing outstanding.
     */
    async acceptUpgrade() {
        if (!this.peerVideoUpgradeRequested)
            return;
        const seen = this.peerVideoStateSeen;
        this.peerVideoUpgradeRequested = false;
        try {
            await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.UpgradeAccept);
        }
        catch (err) {
            this.restorePeerRequest(seen);
            throw err;
        }
        // Held before the sender opens, so the plan that opens it already holds it.
        this.peerVideoReadyGate.hold('upgrade');
        this.openVideoSendPath();
        // Best effort: the upgrade did happen, so a failed announcement is only logged.
        await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.Enabled).catch(() => { });
        this.logger.debug('video upgrade accepted', { callId: this.info.callId });
    }
    /** Declines an upgrade the peer asked for. No-op when it asked for none. */
    async rejectUpgrade() {
        if (!this.peerVideoUpgradeRequested)
            return;
        const seen = this.peerVideoStateSeen;
        this.peerVideoUpgradeRequested = false;
        try {
            await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.UpgradeReject);
        }
        catch (err) {
            this.restorePeerRequest(seen);
            throw err;
        }
        this.logger.debug('video upgrade rejected', { callId: this.info.callId });
    }
    /** Withdraws the request this side sent. No-op when nothing is in flight. */
    async cancelUpgrade() {
        if (!this.pendingVideoUpgrade)
            return;
        // No rollback: the promise is settled for good, and the peer's own timer ends its wait.
        this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Cancelled);
        await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.UpgradeCancel);
        this.logger.debug('video upgrade cancelled', { callId: this.info.callId });
    }
    /** Settles what waits on a handshake and lets go of every path and hold: the call is over. */
    reset() {
        this.videoReceivePathOpened = false;
        // Anything still waiting on a handshake is settled, not left pending forever.
        this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Cancelled);
        this.peerVideoUpgradeRequested = false;
        this.peerVideoStateSeen = 0;
        this.videoSendPathOpened = false;
        this.peerVideoReadyGate.cancel();
        this.videoStateTransactionId = 0;
    }
    applyGroupVideoSend(enabled) {
        this.groupVideoSend = enabled;
        if (enabled)
            this.ensureReceivePath();
        void this.plan.publish({ video: this.section() });
        if (enabled) {
            this.announceVideoLive();
            return;
        }
        if (!this.info.isActive || this.info.stateData.videoOff)
            return;
        this.info.applyTransition({ type: 'video_state_changed', off: true });
        this.delegate.emitState(this.info);
    }
    /**
     * Asks the server to turn a group audio call into a video call: `UpgradeRequest` to the
     * call. Resolves `accepted` once its `<av_upgrade>` arrives, our camera then on, or
     * `timeout`. On a call already carrying video it only turns our camera on.
     */
    async requestGroupVideoUpgrade() {
        if (!this.info.isActive) {
            throw new Error(`Call ${this.info.callId} is not active`);
        }
        if (this.groupSending) {
            throw new Error(`Call ${this.info.callId} already carries video`);
        }
        if (this.info.mediaType === types_js_1.CallMediaType.Video) {
            await this.setGroupEnabled(true);
            return video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Accepted;
        }
        if (this.pendingVideoUpgrade)
            return this.pendingVideoUpgrade.promise;
        let settle;
        const promise = new Promise((resolve) => {
            settle = resolve;
        });
        const timer = setTimeout(() => this.onVideoUpgradeTimeout(), video_state_js_1.WA_VIDEO_UPGRADE_TIMEOUT_MS);
        timer.unref?.();
        this.pendingVideoUpgrade = { timer, settle, promise };
        try {
            await this.sendVideoState(video_state_js_1.WA_VIDEO_STATE.UpgradeRequest);
        }
        catch (err) {
            this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Failed);
            throw err;
        }
        return promise;
    }
    /**
     * Moves the upgrade handshake on the peer's state: a request is only recorded, a terminal
     * code settles ours. Every code but `Enabled` clears the peer's outstanding request.
     */
    applyPeerUpgradeState(state) {
        switch (state) {
            case video_state_js_1.WA_VIDEO_STATE.UpgradeRequest:
            case video_state_js_1.WA_VIDEO_STATE.UpgradeRequestV2:
                this.peerVideoUpgradeRequested = true;
                return;
            case video_state_js_1.WA_VIDEO_STATE.UpgradeAccept:
                this.peerVideoUpgradeRequested = false;
                if (this.pendingVideoUpgrade) {
                    this.openVideoSendPath();
                    this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Accepted);
                    this.sendVideoStateDetached(video_state_js_1.WA_VIDEO_STATE.Enabled);
                }
                return;
            case video_state_js_1.WA_VIDEO_STATE.UpgradeReject:
                this.peerVideoUpgradeRequested = false;
                this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Rejected);
                return;
            case video_state_js_1.WA_VIDEO_STATE.UpgradeRejectByTimeout:
                this.peerVideoUpgradeRequested = false;
                this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.RejectedByTimeout);
                return;
            case video_state_js_1.WA_VIDEO_STATE.Error:
                this.peerVideoUpgradeRequested = false;
                this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.Failed);
                return;
            case video_state_js_1.WA_VIDEO_STATE.UpgradeCancel:
            case video_state_js_1.WA_VIDEO_STATE.UpgradeCancelByTimeout:
                this.peerVideoUpgradeRequested = false;
                return;
            case video_state_js_1.WA_VIDEO_STATE.Enabled:
                this.peerVideoReadyGate.markPeerReady('upgrade');
                return;
            // Also how a peer takes back a request nobody answered in time.
            case video_state_js_1.WA_VIDEO_STATE.Disabled:
                this.peerVideoUpgradeRequested = false;
                return;
            default:
                return;
        }
    }
    /** Puts back the peer request an answer that never left cleared, unless the peer spoke since. */
    restorePeerRequest(seen) {
        if (this.peerVideoStateSeen !== seen)
            return;
        this.peerVideoUpgradeRequested = true;
    }
    /**
     * Ends a request the peer never answered, the call staying audio. The withdrawal is
     * `Disabled`, not `UpgradeCancelByTimeout`: the cancel codes are a deliberate withdrawal.
     */
    onVideoUpgradeTimeout() {
        if (!this.pendingVideoUpgrade)
            return;
        if (this.info.isGroupCall) {
            this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.TimedOut);
            this.logger.debug('group video upgrade timed out', { callId: this.info.callId });
            return;
        }
        this.settleVideoUpgrade(video_state_js_1.WA_VIDEO_UPGRADE_RESULT.TimedOut);
        this.peerVideoUpgradeRequested = false;
        this.logger.debug('video upgrade timed out, staying on audio', {
            callId: this.info.callId,
            timeoutMs: video_state_js_1.WA_VIDEO_UPGRADE_TIMEOUT_MS
        });
        this.sendVideoStateDetached(video_state_js_1.WA_VIDEO_STATE.Disabled);
    }
    /** Settles and drops the request in flight; every path ending a handshake comes here. */
    settleVideoUpgrade(result) {
        const pending = this.pendingVideoUpgrade;
        if (!pending)
            return;
        this.pendingVideoUpgrade = null;
        clearTimeout(pending.timer);
        pending.settle(result);
    }
    /** Sends one `<video>`, numbered by our own counter, never by an id the peer sent. */
    async sendVideoState(state) {
        this.videoStateTransactionId++;
        const id = this.videoStateTransactionId;
        const node = (0, video_state_js_1.buildVideoStateStanza)(this.target(), this.info.callId, this.info.callCreator, {
            state,
            transactionId: id
        });
        try {
            await this.stanzas.send(node);
        }
        catch (err) {
            this.logger.warn('video state send failed', {
                callId: this.info.callId,
                state,
                message: (0, util_1.toError)(err).message
            });
            throw err;
        }
    }
    /** {@link sendVideoState} for a caller that does not wait: the failure is already logged. */
    sendVideoStateDetached(state) {
        void this.sendVideoState(state).catch(() => { });
    }
    /**
     * Opens our video sender on a call negotiated as audio, once the upgrade is agreed; unlike
     * {@link ensureReceivePath}, which any sign of peer video opens. Idempotent.
     */
    openVideoSendPath() {
        this.ensureReceivePath();
        if (this.videoSendPathOpened || this.info.mediaType === types_js_1.CallMediaType.Video) {
            // Nothing to open, but a hold may have started; an unchanged section is not sent.
            void this.plan.publish({ video: this.section() });
            this.announceVideoLive();
            return;
        }
        this.videoSendPathOpened = true;
        void this.plan.publish({ video: this.section() });
        this.announceVideoLive();
        this.logger.debug('video send path opened mid-call', { callId: this.info.callId });
    }
    /** Records our video as live, the one part a call negotiated as video also needs. */
    announceVideoLive() {
        if (!this.info.stateData.videoOff)
            return;
        try {
            this.info.applyTransition({ type: 'video_state_changed', off: false });
        }
        catch (err) {
            this.logger.trace('video state transition skipped', {
                message: (0, util_1.toError)(err).message
            });
            return;
        }
        this.delegate.emitState(this.info);
    }
    /** Lets our held video go, the gate having opened: the peer is ready, or never said so. */
    releaseVideoSend(reason, trigger, heldMs) {
        this.logger.debug('video send released', {
            callId: this.info.callId,
            reason,
            trigger,
            sinceAcceptMs: heldMs
        });
        void this.plan.publish({ video: this.section() });
    }
}
exports.WaCallVideo = WaCallVideo;
