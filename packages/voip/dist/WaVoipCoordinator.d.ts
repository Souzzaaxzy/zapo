import { type LogLevel, type WaClientPluginContext } from 'zapo-js';
import type { MLowRedOptions, WaCallMediaEventMessage, WaCallMediaMessage } from '@zapo-js/voip-media';
import type { CallInfo } from './call/call-state.js';
import type { WaVideoUpgradeResult } from './signaling/video-state.js';
import type { CallManagerEvents, CallOfferOptions, CallVideoSubscription, EndCallReason } from './types.js';
export interface WaVoipCoordinatorOptions {
    /**
     * Maximum simultaneous non-ended calls (ringing, connecting, or active).
     * Default is `1`. Increase to enable parallel multi-call.
     */
    readonly maxConcurrentCalls?: number;
    /**
     * Minimum log level for the VOIP plugin. Defaults to the host client's
     * level; set it to cap the (chatty) VOIP diagnostics independently of the
     * host, e.g. `'warn'` to keep them out of a `trace` host logger.
     */
    readonly logLevel?: LogLevel;
    /**
     * Dial each relay on the port its `<te2>` endpoint advertises instead of on 3480. Defaults
     * per call to `true` on a companion and `false` on a mobile primary; a leg that never answers
     * is redialled once on the other port.
     */
    readonly useOriginalRelayPort?: boolean;
    /**
     * Experimental: carry media over a raw UDP socket to each relay instead of the WebRTC data
     * channel, on the port its `<te2>` endpoint advertises. A leg that sends and hears nothing
     * back within a few seconds closes itself. Defaults to `false`.
     */
    readonly useRawUdpTransport?: boolean;
    /**
     * Weights of the MLow Companion decoder post-filter: the bytes of `mlow_companion_v1.pte`, or a
     * path read on the first call. Not shipped; costs about 40 times the decode CPU, and weights that
     * fail to load leave calls decoding without it. With remote media, pass it to the host's
     * `WaCallMediaReceiver` as `mlowCompanionModel` instead.
     */
    readonly mlowCompanionModel?: Uint8Array | ArrayBuffer | string;
    /**
     * Sends MLow RED: each packet carries the low-rate copy of the frame before, then the frame.
     * Off by default; turning it on turns DTX off.
     * With remote media, pass it to the host's `WaCallMediaReceiver` as `mlowRed` instead.
     */
    readonly mlowRed?: boolean | MLowRedOptions;
    /**
     * Where call media runs. `local` (default) carries it in this process on `@roamhq/wrtc` and
     * `libmlow-wasm-fork`. `remote` emits each plan change as `voip_call_media` for a host
     * running `WaCallMediaReceiver`, whose events return through {@link WaVoipCoordinator.media}.
     */
    readonly media?: {
        readonly mode: 'local' | 'remote';
    };
    /**
     * Emits `voip_call_participant_audio`: each group-call participant's decoded audio apart,
     * before the mix. Off by default, since every frame is copied for it. Local media only.
     */
    readonly participantAudio?: boolean;
}
/** The side of `client.voip` a remote media host talks to. */
export interface WaVoipMediaApi {
    /** Hands over an event the media host sent back, as it arrived. */
    handleEvent(message: WaCallMediaEventMessage): void;
    /**
     * The whole media plan of a call as it stands, for a host that joins late or
     * missed a message; `null` for an unknown call or local media.
     */
    snapshot(callId: string): WaCallMediaMessage | null;
}
/**
 * WaClient-facing VOIP coordinator. Owns a {@link WaCallManager}, registers
 * incoming `<call>` / call-class `<ack>` / call `<receipt>` handlers (prepend,
 * returns `true`) so the core client does not double-ack, and re-emits manager
 * events on the host {@link WaClient}.
 */
export declare class WaVoipCoordinator {
    private readonly manager;
    private readonly deps;
    private readonly logger;
    private readonly unregisterHandlers;
    /** What a remote media host talks to; see {@link WaVoipCoordinatorOptions.media}. */
    readonly media: WaVoipMediaApi;
    constructor(ctx: WaClientPluginContext, options?: WaVoipCoordinatorOptions);
    /**
     * Place an outgoing call to `options.peerJid` (optionally video, with a
     * preloaded `audioFile`). Resolves with the new call id once the offer is
     * sent; progress then arrives via `voip_call_state`. Rejects when at the
     * concurrent-call limit or if the offer fails to send.
     *
     * Set `options.groupJid` and `options.participants` to place a group call
     * instead, addressed to the call itself; `peerJid` is then not read.
     */
    startCall(options: CallOfferOptions): Promise<string>;
    /**
     * Accept a ringing incoming call. Throws if `callId` is unknown or not in
     * an acceptable state.
     */
    acceptCall(callId: string): Promise<void>;
    /**
     * Reject a ringing incoming call, optionally with an {@link EndCallReason}
     * (defaults to `Declined`). Sends the reject stanza, then tears the call
     * down.
     */
    rejectCall(callId: string, reason?: EndCallReason): Promise<void>;
    /**
     * End an active or connecting call, optionally with an {@link EndCallReason}
     * (defaults to `UserEnded`). Sends the terminate stanza, then tears the
     * call down. No-op if the call is unknown or already ended. On a group call
     * this only takes us out, like {@link leaveCall}: the call ends for everybody
     * once its last member leaves, as with the official client.
     */
    endCall(callId: string, reason?: EndCallReason): Promise<void>;
    /**
     * Leave a group call the other participants stay on. The same as {@link endCall} on a
     * group call, and the call ends for everybody once its last member leaves. No-op if the
     * call is unknown or already ended; throws on a 1:1 call.
     */
    leaveCall(callId: string): Promise<void>;
    /**
     * Join a group call already in progress that this side declined, let ring out or left,
     * while it goes on. Progress arrives via `voip_call_state`, as on an accepted call. Throws
     * when no such call is known here (only one this side was rung for), when this side is on
     * it already, or at the concurrent-call limit.
     */
    joinCall(callId: string): Promise<void>;
    /**
     * Preload an audio file (decoded via ffmpeg) as the outbound audio for
     * `callId`, played once the call is active. For an unbounded or live source
     * use {@link setExternalAudioMode} + {@link feedLiveAudio} instead. Needs
     * ffmpeg on PATH; throws if the file is missing or ffmpeg is unavailable.
     */
    loadAudio(callId: string, audioPath: string): Promise<void>;
    /**
     * Mute or unmute the local outbound audio for `callId` and announce it to the peer. A
     * no-op toggle, an inactive call and an unknown `callId` all do nothing.
     */
    setMute(callId: string, muted: boolean): void;
    /**
     * Ask one participant of a group call to mute, by its device jid. A request: the target
     * decides, and a `voip_call_peer_mute` follows if it complies. Throws on an unknown
     * `callId`, a 1:1 call or a failed send.
     */
    requestParticipantMute(callId: string, participantJid: string): Promise<void>;
    /**
     * Raise or lower the local hand on `callId` and announce it to the peer. Durable state:
     * the peer keeps seeing the hand until it is lowered. Repeating it sends nothing, an
     * inactive call is a no-op, and the peer's own hands are `voip_call_hand_raise` /
     * {@link CallInfo.raisedHands}. Throws on an unknown `callId` or a failed send.
     */
    setHandRaised(callId: string, raised: boolean): Promise<void>;
    /**
     * Start or stop sharing the screen on `callId`, announcing it to the peer. Not a second
     * stream: the screen replaces the camera on the call's existing video stream, so
     * whatever reaches {@link feedLiveVideo} from here on is what the peer renders as the
     * share. Throws on an unknown `callId` or a failed send, and - starting a share only -
     * on a call with no video yet ({@link requestVideoUpgrade} or {@link setVideoEnabled}
     * first).
     */
    setScreenShare(callId: string, sharing: boolean): Promise<void>;
    /**
     * Sends an emoji reaction on a call, as the glyph itself. Returns `false` when nothing
     * went on the wire: the call is not active, or its app-data stream is not open yet.
     */
    sendReaction(callId: string, reaction: string): boolean;
    /**
     * Turn our camera on or off on a group call: whatever reaches {@link feedLiveVideo}
     * afterwards goes to the call, and the others are told. A no-op on an inactive call.
     * Throws on an unknown `callId`, a failed send, or a 1:1 call, which turns video on
     * through {@link requestVideoUpgrade}.
     */
    setVideoEnabled(callId: string, enabled: boolean): Promise<void>;
    /**
     * Choose which participants' video a group call asks the relay for, and at what quality.
     * `null` returns to the default: every participant with the camera on. Not applied by a
     * media host that cannot carry it. Throws on an unknown `callId`.
     */
    setVideoSubscriptions(callId: string, subscriptions: readonly CallVideoSubscription[] | null): void;
    /**
     * Ask the peer to turn an audio call into a video call and wait for the answer. Resolves
     * with one of {@link WA_VIDEO_UPGRADE_RESULT}; only `accepted` means
     * {@link feedLiveVideo} now reaches the wire. Bounded by the peer's own guard timer, so
     * it settles in about five seconds even against a client that never answers. On a group
     * call the server is asked instead: `accepted` once it turns the call into a video call,
     * with our camera on; a group call already carrying video only turns the camera on.
     * Throws on an unknown `callId`, an inactive call, or one where we already send video.
     */
    requestVideoUpgrade(callId: string): Promise<WaVideoUpgradeResult>;
    /**
     * Accept an upgrade the peer asked for on `callId`, turning the call into a video call
     * and opening the local video sender. The request arrives as a
     * `voip_call_peer_video_state` with `change.state` of `UpgradeRequestV2`; no-op when the
     * peer has none outstanding.
     *
     * Our frames are then held until the peer's camera is on, or three seconds at most:
     * {@link feedLiveVideo} returns `0` meanwhile, and the stream opens on the next key frame.
     */
    acceptVideoUpgrade(callId: string): Promise<void>;
    /**
     * Decline an upgrade the peer asked for on `callId`, leaving the call on audio.
     * No-op when the peer has no request outstanding; throws if `callId` is unknown.
     */
    rejectVideoUpgrade(callId: string): Promise<void>;
    /**
     * Withdraw an upgrade request sent from this side before the peer has answered it;
     * the pending {@link requestVideoUpgrade} then resolves with `cancelled`. No-op
     * when nothing is in flight; throws if `callId` is unknown.
     */
    cancelVideoUpgrade(callId: string): Promise<void>;
    /**
     * Switch `callId` to external (live) audio mode. While enabled, outbound
     * audio comes from {@link feedLiveAudio} through a bounded jitter buffer
     * instead of a preloaded file. Disable to return to preloaded playback.
     */
    setExternalAudioMode(callId: string, enabled: boolean): void;
    /**
     * Feed a chunk of live mono PCM (`Float32Array` at the engine sample rate)
     * into an active call's outbound audio. Requires external audio mode (see
     * {@link setExternalAudioMode}). Returns the audio currently buffered
     * ahead of the sender in milliseconds, so a producer can pace itself
     * against {@link getFeedWatermarksMs}; returns `0` when no session exists
     * for `callId`. The buffer is bounded and drops the oldest samples on
     * overflow.
     */
    feedLiveAudio(callId: string, data: Float32Array): number;
    /**
     * Feed one H.264 Annex-B encoded access unit into an active video call.
     * `timestampUs` is the capture timestamp in microseconds. Returns the number
     * of RTP packets sent, or `0` when video media is not active, is still held
     * for the peer after {@link acceptVideoUpgrade}, or waits for a key frame to
     * open on. Always `0` with remote media, where the media host sends the video.
     */
    feedLiveVideo(callId: string, data: Uint8Array, timestampUs: number): number;
    /**
     * Milliseconds of live audio currently buffered ahead of the sender for
     * `callId` (`0` when no session exists or external mode is off). Poll it to
     * drive backpressure against {@link getFeedWatermarksMs}.
     */
    getLiveBufferMs(callId: string): number;
    /**
     * Backpressure watermarks for the live feed, in milliseconds. Constants of
     * the feed contract, independent of any specific call: pause feeding once
     * {@link getLiveBufferMs} reaches `pauseMs`, resume once it drains to
     * `resumeMs`. `pauseMs` stays below the engine's internal drop threshold,
     * so a producer that respects it never loses audio.
     */
    getFeedWatermarksMs(): {
        pauseMs: number;
        resumeMs: number;
    };
    /** Current {@link CallInfo} snapshot for `callId`, or `null` if unknown. */
    getCall(callId: string): CallInfo | null;
    /** Snapshot of every tracked call (ringing, connecting, or active). */
    getCalls(): readonly CallInfo[];
    /**
     * Subscribe directly to a low-level {@link CallManagerEvents} event. Most
     * consumers should use the client-level `client.on('voip_*')` events
     * instead. Returns `this` for chaining.
     */
    on<K extends keyof CallManagerEvents>(event: K, listener: CallManagerEvents[K]): this;
    /** Remove a listener registered via {@link on}. Returns `this`. */
    off<K extends keyof CallManagerEvents>(event: K, listener: CallManagerEvents[K]): this;
    /** Like {@link on}, but the listener fires at most once. Returns `this`. */
    once<K extends keyof CallManagerEvents>(event: K, listener: CallManagerEvents[K]): this;
    /**
     * Tear down the coordinator: unregister the incoming `<call>` / ack /
     * receipt handlers and destroy all active calls. Invoked by the plugin
     * system on client disconnect; not normally called directly.
     */
    dispose(): void;
    private registerIncomingHandlers;
    /** Forwards inbound audio only while the client listens, so no listener costs no copy. */
    private wireInboundAudio;
    private wireClientEvents;
}
