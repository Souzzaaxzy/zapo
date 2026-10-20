import { performance } from 'node:perf_hooks';
/** Wait after the peer's camera turns on: the sign can beat the peer's inbound stream setup. */
export const UPGRADE_VIDEO_READY_GUARD_MS = 300;
/** Longest wait from the accept for a peer that never turns its camera on after an upgrade. */
export const UPGRADE_VIDEO_READY_TIMEOUT_MS = 3000;
/** Wait after the peer's first `<mute_v2>` on a born-video call; the sign can beat its setup. */
export const BORN_VIDEO_READY_GUARD_MS = 150;
/** Longest wait from the accept for a peer that sends no `<mute_v2>` on a born-video call. */
export const BORN_VIDEO_READY_TIMEOUT_MS = 2000;
/** The guard and the timeout each trigger runs on. */
const PEER_VIDEO_READY_TIMINGS = Object.freeze({
    upgrade: { guardMs: UPGRADE_VIDEO_READY_GUARD_MS, timeoutMs: UPGRADE_VIDEO_READY_TIMEOUT_MS },
    'born-video': { guardMs: BORN_VIDEO_READY_GUARD_MS, timeoutMs: BORN_VIDEO_READY_TIMEOUT_MS }
});
/**
 * Holds our video from the accept until the peer can take it: if our first packet beats the
 * peer's inbound stream, WhatsApp Web shows only our key frames for the rest of the call.
 */
export class WaPeerVideoReadyGate {
    /**
     * `onOpen` runs once per hold, when it lets the video go, never on {@link cancel}. `now` times
     * the hold in ms, on a monotonic clock so a wall-clock change cannot skew it.
     */
    constructor(onOpen, now = () => performance.now()) {
        /** What the current hold waits on, or `null` while nothing is held. */
        this.heldFor = null;
        /** When the hold started, on {@link now}; meaningful only while held. */
        this.heldSince = 0;
        this.guardTimer = null;
        this.timeoutTimer = null;
        this.onOpen = onOpen;
        this.now = now;
    }
    get isHeld() {
        return this.heldFor !== null;
    }
    /** Starts holding our video for `trigger`; its timeout counts from now. No-op while held. */
    hold(trigger) {
        if (this.heldFor !== null)
            return;
        this.heldFor = trigger;
        this.heldSince = this.now();
        this.timeoutTimer = setTimeout(() => this.open('timeout'), PEER_VIDEO_READY_TIMINGS[trigger].timeoutMs);
        // A guard timer must not keep an otherwise idle program alive.
        this.timeoutTimer.unref?.();
    }
    /**
     * The peer gave `trigger`'s sign: the video goes once its guard runs. Only counts during a
     * hold of the same trigger; the first sign starts the guard.
     */
    markPeerReady(trigger) {
        if (this.heldFor !== trigger || this.guardTimer)
            return;
        this.guardTimer = setTimeout(() => this.open('peer-ready'), PEER_VIDEO_READY_TIMINGS[trigger].guardMs);
        this.guardTimer.unref?.();
    }
    /** Stops holding without letting the video go: the call is over. */
    cancel() {
        this.heldFor = null;
        if (this.guardTimer) {
            clearTimeout(this.guardTimer);
            this.guardTimer = null;
        }
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }
    open(reason) {
        const trigger = this.heldFor;
        if (trigger === null)
            return;
        const heldMs = this.now() - this.heldSince;
        this.cancel();
        this.onOpen(reason, trigger, heldMs);
    }
}
