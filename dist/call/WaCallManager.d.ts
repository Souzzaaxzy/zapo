import { EventEmitter } from 'node:events';
import { type Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import type { MLowRedOptions, WaCallMediaEvent, WaCallMediaMessage } from '@zapo-js/voip-media';
import { type WaVideoUpgradeResult } from '../signaling/video-state.js';
import { type CallOfferOptions, type CallVideoSubscription, EndCallReason, type WaVoipDeps, type WaVoipStores } from '../types.js';
import { CallInfo } from './call-state.js';
import { type WaJoinableCall } from './WaJoinableCalls.js';
export interface WaCallManagerConfig {
    deps: WaVoipDeps;
    stores: WaVoipStores;
    logger?: Logger;
    maxConcurrentCalls?: number;
    useOriginalRelayPort?: boolean;
    useRawUdpTransport?: boolean;
    /** See `WaVoipCoordinatorOptions.mlowCompanionModel`. */
    mlowCompanionModel?: Uint8Array | ArrayBuffer | string;
    /** See `WaVoipCoordinatorOptions.mlowRed`. */
    mlowRed?: boolean | MLowRedOptions;
    /** Where call media runs; see `WaVoipCoordinatorOptions.media`. */
    mediaMode?: WaCallMediaMode;
    /** See `WaVoipCoordinatorOptions.participantAudio`. */
    participantAudio?: boolean;
}
/** `local` carries the media in this process; `remote` hands its plan to a host elsewhere. */
export type WaCallMediaMode = 'local' | 'remote';
export declare class WaCallManager extends EventEmitter {
    private readonly deps;
    private readonly stores;
    private readonly logger;
    private readonly maxConcurrentCalls;
    /** Unset, each call picks by session: the advertised port on a companion, 3480 on a primary. */
    private readonly useOriginalRelayPort;
    private readonly useRawUdpTransport;
    private readonly mlowCompanionModel;
    private readonly mlowRed;
    private readonly mediaMode;
    private readonly participantAudio;
    private readonly signalingLogger;
    private readonly calls;
    /** When the offer ack for a call arrived; absent means it never did. */
    private readonly lastAckAt;
    /** Set by `destroy`: an offer still resolving when it ran must not make a call. */
    private destroyed;
    private readonly outOfOrder;
    private readonly joinableCalls;
    private readonly reporter;
    constructor(config: WaCallManagerConfig);
    /**
     * Places a 1:1 call to `options.peerJid`, or a group call when `options.groupJid` is set.
     * Throws once the manager is destroyed, even mid-way: no offer goes out after `destroy`.
     */
    startCall(options: CallOfferOptions): Promise<string>;
    /**
     * Places a group call: one offer to the call itself naming every participant. It carries
     * no key: the call is keyed later over `enc_rekey`.
     */
    private startGroupCall;
    /**
     * Watches a hash-based group offer for the ack that never comes.
     *
     * <p>A roster too large to name is referenced by its hash and resolved by the server against
     * the group; when the server drops such an offer it answers nothing at all, and "the call went
     * up and nothing appeared" looks exactly like a call still being set up. The timer is unref'd so
     * it never holds the process open, and it only logs -- it does not end the call.
     */
    private armHashOfferWatchdog;
    acceptCall(callId: string): Promise<void>;
    rejectCall(callId: string, reason?: EndCallReason): Promise<void>;
    endCall(callId: string, reason?: EndCallReason): Promise<void>;
    /**
     * Leaves a group call the others stay on. No-op on an unknown or ended call.
     *
     * @throws on a call that is no group's, where only {@link endCall} applies.
     */
    leaveCall(callId: string, reason?: EndCallReason): Promise<void>;
    setMute(callId: string, muted: boolean): void;
    /** Asks one participant of a group call to mute; see {@link WaCallMediaSession.requestParticipantMute}. */
    requestParticipantMute(callId: string, participantJid: string): Promise<void>;
    setVideoEnabled(callId: string, enabled: boolean): Promise<void>;
    /** Sets whose video a group call asks for; `null` hands it back to the session's policy. */
    setVideoSubscriptions(callId: string, subscriptions: readonly CallVideoSubscription[] | null): void;
    /** The joinable call this side is off, if one is remembered under `callId`. @internal */
    getJoinableCall(callId: string): WaJoinableCall | null;
    /**
     * Joins a group call going on without this side: a group accept to the call itself.
     * @throws when no such call is remembered, this side is on it, at the call limit, or when the
     * join fails, which leaves the call joinable.
     */
    joinCall(callId: string): Promise<void>;
    setHandRaised(callId: string, raised: boolean): Promise<void>;
    setScreenShare(callId: string, sharing: boolean): Promise<void>;
    /** Sends an emoji reaction. `false` when nothing went on the wire. */
    sendReaction(callId: string, reaction: string): boolean;
    requestVideoUpgrade(callId: string): Promise<WaVideoUpgradeResult>;
    acceptVideoUpgrade(callId: string): Promise<void>;
    rejectVideoUpgrade(callId: string): Promise<void>;
    cancelVideoUpgrade(callId: string): Promise<void>;
    loadAudio(callId: string, audioPath: string): Promise<void>;
    setExternalAudioMode(callId: string, enabled: boolean): void;
    feedLiveAudio(callId: string, data: Float32Array): number;
    feedLiveVideo(callId: string, data: Uint8Array, timestampUs: number): number;
    getLiveBufferMs(callId: string): number;
    getFeedWatermarksMs(): {
        pauseMs: number;
        resumeMs: number;
    };
    getCall(callId: string): CallInfo | null;
    getCalls(): readonly CallInfo[];
    /**
     * A re-ring (`re-ring`) rings this side again on a call already going, with no `<relay>`: a
     * terminate held for its id belonged to the earlier ring and does not drop it.
     */
    handleCallOffer(node: BinaryNode, peerJid: string): Promise<void>;
    /**
     * An `<accept>` from another device of this account on an incoming call ends it (answered
     * elsewhere) and frees its slot.
     */
    handleCallAccept(node: BinaryNode, peerJid: string): Promise<void>;
    handleCallPreaccept(node: BinaryNode, peerJid: string): Promise<void>;
    handleCallTransport(node: BinaryNode): Promise<void>;
    /** An ack refusing our offer ends the call, which frees its slot. */
    handleCallAck(node: BinaryNode): Promise<void>;
    handleCallRelaylatency(node: BinaryNode, peerJid: string): void;
    handleRelayElection(node: BinaryNode): void;
    handleCallMuteV2(node: BinaryNode, peerJid: string): void;
    handleCallUserAction(node: BinaryNode, peerJid: string): void;
    /**
     * A top-level `<raise_hand>`: a message type of its own rather than a variant of
     * `<user_action>`, and both are live on the wire, so both have to route.
     */
    handleCallRaiseHand(node: BinaryNode, peerJid: string): void;
    handleCallScreenShare(node: BinaryNode, peerJid: string): void;
    handleCallVideoState(node: BinaryNode, peerJid: string): void;
    /**
     * A `<group_update>`: a roster, a reissued relay, or a rekey asked of this side. One for a
     * joinable call this side is off updates what is remembered of it.
     */
    handleCallGroupUpdate(node: BinaryNode): Promise<void>;
    /**
     * An `<enc_rekey>`, the only carrier of a group call's key. Decrypted here so a key that
     * beats its offer can be held for it; the `<receipt>` answers the stanza either way.
     */
    handleCallEncRekey(node: BinaryNode, peerJid: string): Promise<void>;
    /**
     * A terminate that finds no call is kept, so the offer still decrypting for it is dropped,
     * unless it is `joinable`: one participant of a pending group call says nothing of the call.
     * `group_call_ended` ends a group call in any state; the server's ring-out ends our ring only.
     */
    handleCallTerminate(node: BinaryNode, peerJid?: string): Promise<void>;
    destroy(): void;
    /**
     * The server ending our ring of a group call that goes on: `joinable`, no reason, from the
     * call itself, on an incoming call still ringing.
     */
    private isRingOut;
    /**
     * The server taking this side off a group call that goes on, its media no longer reaching
     * the others: `user_invisible` from the call itself, which sends it to the removed member only.
     */
    private isRemovedAsInvisible;
    /** Ends the call here with nothing sent, the call going on, and remembers it for a join. */
    private endHere;
    private throwIfDestroyed;
    /** Terminates an offer that left while `destroy` ran, as a leave would; best effort. */
    private withdrawOffer;
    /** Answers one `<enc_rekey>`; one with no id goes unanswered. */
    private sendEncRekeyReceipt;
    private get activeCallCount();
    private createSession;
    /**
     * Applies a call key an `<enc_rekey>` delivered ahead of the call. Run once the composition
     * is seeded: a roster-only offer is a group call only from then on, and before it the key
     * would be refused and lost.
     */
    private applyPendingCallKey;
    /**
     * Hands an event from a remote media host to its call. Events for a call that no longer
     * exists are dropped: the host may still be winding down.
     */
    handleMediaEvent(callId: string, event: WaCallMediaEvent): void;
    /**
     * The whole media plan of a call, for a host that joins late or lost track of
     * the messages. `null` for an unknown call, or when the media runs locally.
     */
    getMediaSnapshot(callId: string): WaCallMediaMessage | null;
    private createMediaLink;
    private getSessionOrThrow;
    private resolveSessionFromNode;
    private resolveSessionForOfferAck;
    /** Frees the slot of a call that ended, letting a waiting incoming call take it. */
    private release;
    /** Drops a call that never got going, or a dead one its id is about to be reused for. */
    private discard;
    private maybeUnblockWaitingCalls;
    private activateWaitingIncoming;
    /**
     * Brings an incoming call up: the peer's devices first among the relay participants, then
     * media, preaccept and relay latency. `false` once a concurrent end stopped it.
     */
    private activateIncoming;
    /**
     * Whether a `<terminate>` or `<accept>` handled concurrently ended the call mid-setup; that
     * path already reported the end, so setup stops and cleans up again.
     */
    private endedDuringSetup;
}
