/**
 * Why our video is held, which picks its release sign: the peer's camera turning on after
 * an accepted upgrade, or its first `<mute_v2>` after the accept of a born-video call.
 */
export type PeerVideoReadyTrigger = 'upgrade' | 'born-video';
/** Wait after the peer's camera turns on: the sign can beat the peer's inbound stream setup. */
export declare const UPGRADE_VIDEO_READY_GUARD_MS = 300;
/** Longest wait from the accept for a peer that never turns its camera on after an upgrade. */
export declare const UPGRADE_VIDEO_READY_TIMEOUT_MS = 3000;
/** Wait after the peer's first `<mute_v2>` on a born-video call; the sign can beat its setup. */
export declare const BORN_VIDEO_READY_GUARD_MS = 150;
/** Longest wait from the accept for a peer that sends no `<mute_v2>` on a born-video call. */
export declare const BORN_VIDEO_READY_TIMEOUT_MS = 2000;
/** What let our video go: the peer said it was ready, or it never did in time. */
export type PeerVideoReadyGateReason = 'peer-ready' | 'timeout';
/**
 * Holds our video from the accept until the peer can take it: if our first packet beats the
 * peer's inbound stream, WhatsApp Web shows only our key frames for the rest of the call.
 */
export declare class WaPeerVideoReadyGate {
    private readonly onOpen;
    /** What the current hold waits on, or `null` while nothing is held. */
    private heldFor;
    private readonly now;
    /** When the hold started, on {@link now}; meaningful only while held. */
    private heldSince;
    private guardTimer;
    private timeoutTimer;
    /**
     * `onOpen` runs once per hold, when it lets the video go, never on {@link cancel}. `now` times
     * the hold in ms, on a monotonic clock so a wall-clock change cannot skew it.
     */
    constructor(onOpen: (reason: PeerVideoReadyGateReason, trigger: PeerVideoReadyTrigger, heldMs: number) => void, now?: () => number);
    get isHeld(): boolean;
    /** Starts holding our video for `trigger`; its timeout counts from now. No-op while held. */
    hold(trigger: PeerVideoReadyTrigger): void;
    /**
     * The peer gave `trigger`'s sign: the video goes once its guard runs. Only counts during a
     * hold of the same trigger; the first sign starts the guard.
     */
    markPeerReady(trigger: PeerVideoReadyTrigger): void;
    /** Stops holding without letting the video go: the call is over. */
    cancel(): void;
    private open;
}
