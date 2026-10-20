import type { Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import { type WaCallMediaEvent, type WaCallMediaMessage, type WaCallReaction } from '@zapo-js/voip-media';
import { type PeerScreenShare } from '../signaling/screen-share.js';
import { type WaVideoUpgradeResult } from '../signaling/video-state.js';
import { type WaVoipSettings } from '../signaling/voip-settings.js';
import { type CallVideoSubscription, EndCallReason, type InboundVideoFrame, type InboundVideoRtpPacket, type PeerVideoStateChange, type RelayData, type WaVoipDeps } from '../types.js';
import { type CallInfo } from './call-state.js';
import { type WaCallGroupParticipant, type WaGroupCompositionDiff } from './group-participants.js';
import type { WaCallMediaLink, WaCallMediaLinkEvents } from './media-link.js';
export interface WaCallMediaSessionDelegate {
    emitState(call: CallInfo): void;
    emitIncoming(call: CallInfo): void;
    emitEnded(call: CallInfo): void;
    /** `participantJid` is the device that announced it, device 0 bare. */
    emitPeerMute(call: CallInfo, muted: boolean, participantJid?: string): void;
    emitInboundAudio(call: CallInfo, data: Float32Array): void;
    emitInboundVideoRtp(call: CallInfo, packet: InboundVideoRtpPacket, participantJid?: string): void;
    emitInboundVideo(call: CallInfo, frame: InboundVideoFrame, participantJid?: string): void;
    emitScreenShare(call: CallInfo, share: PeerScreenShare, participantJid?: string): void;
    emitPeerVideoState(call: CallInfo, change: PeerVideoStateChange, participantJid?: string): void;
    emitOutboundAudioFinished(call: CallInfo): void;
    emitHandRaise(call: CallInfo, participantJid: string, raised: boolean): void;
    /** One in-band emoji reaction, deduplicated: the sender repeats it, this fires once. */
    emitCallReaction?(call: CallInfo, reaction: WaCallReaction, participantJid?: string): void;
    /** A participant asked us to mute, with `request-state` as it arrived. Nothing is muted. */
    emitMuteRequested?(call: CallInfo, participantJid: string, requestState: string): void;
    /** A group participant's media started or stopped reaching us. */
    emitParticipantMedia?(call: CallInfo, participantJid: string, receiving: boolean): void;
    /** One group participant's decoded audio, before the mix. */
    emitParticipantAudio?(call: CallInfo, participantJid: string, pcm: Float32Array): void;
    /** The server turned a group call into a video call, at `upgraderJid`'s request when known. */
    emitVideoUpgraded?(call: CallInfo, upgraderJid: string | null): void;
    /** Whether anything takes {@link emitInboundAudio} right now; absent means always. */
    wantsInboundAudio?(): boolean;
    /** A change to the media plan, for a host elsewhere to apply; remote media only. */
    emitMediaPlan?(call: CallInfo, message: WaCallMediaMessage): void;
    /** Who joined, left or moved on a group call; `call.groupComposition` is the result. */
    emitParticipantsChanged?(call: CallInfo, diff: WaGroupCompositionDiff): void;
    /** A problem the call carries on through. */
    emitError?(call: CallInfo, error: Error): void;
    /** Ends the call through its owner, for a session that has to end itself. */
    endCall(call: CallInfo, reason: EndCallReason): void;
}
export interface WaCallMediaSessionOptions {
    readonly deps: WaVoipDeps;
    readonly logger: Logger;
    readonly info: CallInfo;
    readonly delegate: WaCallMediaSessionDelegate;
    /** Builds the link to wherever this call's media runs, in this process or elsewhere. */
    readonly createMediaLink: (events: WaCallMediaLinkEvents) => WaCallMediaLink;
    /** Monotonic clock the video hold is timed on, in ms; `performance.now` by default. */
    readonly now?: () => number;
}
/**
 * The signaling of one call, and the source of its media plan: what the stanzas teach the
 * media is derived into the plan and published on the media link.
 */
export declare class WaCallMediaSession {
    readonly info: CallInfo;
    private readonly deps;
    private readonly logger;
    private readonly delegate;
    private readonly media;
    private readonly stanzas;
    private readonly plan;
    private readonly streams;
    private readonly relays;
    private readonly subscriptions;
    private readonly roster;
    private readonly rekey;
    private readonly liveness;
    private readonly announcements;
    private readonly video;
    private initialTransportSent;
    private outgoingPreacceptSent;
    private acceptedByJid;
    private readonly now;
    /** Whether a repeated `<video>` transaction id is dropped rather than only logged. */
    private videoStateTxnEnforced;
    private readonly derivations;
    constructor(options: WaCallMediaSessionOptions);
    get callId(): string;
    private get isGroupCall();
    /** Where our in-call stanzas go: the call itself on a group call, else the answering device. */
    private inCallTarget;
    /**
     * The device a media event came from: its sender's on a group call, the answering device on
     * a 1:1 call, `undefined` when a group sender is unknown.
     */
    private senderJidOf;
    /** Forgets a device that left the call: its media state, and a hand it still had up. */
    private forgetParticipantDevice;
    /**
     * Drops an `accepted_elsewhere` from a peer device other than the one that answered a call
     * we placed. Never on an incoming call: there the caller sends it about our own devices.
     */
    shouldIgnoreTerminate(peerJid: string | undefined, reason: string | undefined): boolean;
    initMedia(selfLid: string, peerJid: string): Promise<void>;
    /**
     * Stores the call's `<voip_settings>` and hands the media what it tunes; again mid-call for
     * the profile an upgrade request carries. `null`, an absent or unreadable node, changes nothing.
     */
    applyVoipSettings(settings: WaVoipSettings | null): void;
    acceptCall(): Promise<void>;
    rejectCall(reason?: EndCallReason): Promise<void>;
    /** Ends the call; on a group call only this side leaves, as {@link leaveCall}. */
    endCall(reason?: EndCallReason): Promise<void>;
    /**
     * Leaves a group call the others stay on: one reason-less terminate to the call itself.
     * @throws on a call that is no group's.
     */
    leaveCall(reason?: EndCallReason): Promise<void>;
    /** The terminate of this call: to the call itself on a group call, else the answering device. */
    buildTerminateStanza(audioDurationMs?: number, wireReason?: string): BinaryNode;
    private terminate;
    /** Mutes our capture and announces it; the media keeps sending silence on the same SSRC. */
    setMute(muted: boolean): void;
    /** Raises or lowers our hand; the state moves only once the stanza left, else it rethrows. */
    setHandRaised(raised: boolean): Promise<void>;
    /**
     * Tells the peer our video stream now carries the screen, or no longer; feeding it is the
     * caller's job. @throws when the send fails, or to start one on a call with no video yet.
     */
    setScreenShare(sharing: boolean): Promise<void>;
    loadAudio(audioPath: string): Promise<void>;
    setExternalAudioMode(enabled: boolean): void;
    feedLiveAudio(data: Float32Array): number;
    /** `0` with our group camera off: nothing leaves after the `<video state='6'>`. */
    feedLiveVideo(data: Uint8Array, timestampUs: number): number;
    getLiveBufferMs(): number;
    /** A group callee preaccepts to the call itself, which is where its capability goes. */
    sendIncomingPreaccept(peerJid: string): Promise<void>;
    /**
     * One `<relaylatency>` per relay that answered us, each once per call: every device of the
     * peer preaccepts, and a name is claimed before its send yields. Stops once the call has
     * ended. The callee dials only on accept, so it names nothing while it rings.
     */
    sendRelayLatency(): Promise<void>;
    /**
     * An `<accept>`: the peer answering a 1:1 call we placed, a group participant joining, or on
     * an incoming 1:1 call another device of this account, which ends our ring.
     */
    handleCallAccept(node: BinaryNode, peerJid: string): Promise<void>;
    /** An `<accept>` on a group call; the roster usually connects a call we placed first. */
    private handleGroupAccept;
    /**
     * Moves a group call we placed out of ringing, once: the first participant joined. The
     * caller emits the state and publishes `accepted`, which is what starts the media.
     */
    private joinPlacedGroupCall;
    handleCallPreaccept(node: BinaryNode, peerJid: string): Promise<void>;
    /**
     * Hands the relays a `<transport>` lists to the media, dialled once the call has no leg; on
     * a group call its `<relay>` is followed like a reissue.
     */
    handleCallTransport(node: BinaryNode): Promise<void>;
    handleCallAck(node: BinaryNode): Promise<void>;
    /**
     * Records the peer's relay latencies and sends nothing back: answering every one made two
     * clients that both answer bounce it between them forever.
     */
    handleCallRelaylatency(node: BinaryNode, peerJid: string): void;
    /** Logged only: the media elects its own relay. */
    handleRelayElection(node: BinaryNode): void;
    /**
     * Records the microphone state a `<mute_v2>` announces; one from our own account, or a mute
     * request on a 1:1 call, is dropped. Also the born-video sign our held video waits on.
     */
    handleCallMuteV2(node: BinaryNode, peerJid: string): void;
    /**
     * Asks a group participant's device to mute; it decides. An account names its first device.
     * @throws on a 1:1 call, for somebody not on the call, or when the send fails.
     */
    requestParticipantMute(participantJid: string): Promise<void>;
    /** The `<user_action>` envelope carries several actions; only raise hand is read. */
    handleCallUserAction(node: BinaryNode, peerJid: string): void;
    /** A top-level `<raise_hand>`: a message type of its own, still sent beside `<user_action>`. */
    handleCallRaiseHand(node: BinaryNode, peerJid: string): void;
    /** Records the screen-share state a `screen_share` or `screen` stanza carried; nothing goes back. */
    handleCallScreenShare(node: BinaryNode, participantJid?: string): void;
    /**
     * Applies a `<video>` from the peer: a video state change, and with it the upgrade handshake.
     * A replayed `transaction-id` is dropped only when the profile enforces it.
     */
    handleCallVideoState(node: BinaryNode, participantJid?: string): void;
    /**
     * Seeds a group call's composition from the `<group_info>` of its offer, leaving out whoever
     * it already reports off the call. An unreadable or empty one seeds nothing.
     */
    seedGroupComposition(inner: BinaryNode): void;
    /**
     * Seeds a group call we join after its ring from what was kept of it: the last roster seen,
     * the server's settings and, when known, its relay. Without a relay the media waits for the
     * one the `group_update` answering our accept brings.
     */
    seedGroupJoin(context: {
        readonly participants: readonly WaCallGroupParticipant[];
        readonly transactionId: number | null;
        readonly relayData?: RelayData;
        readonly voipSettings?: WaVoipSettings | null;
    }): void;
    /** Seeds the composition of a group call we place, from the participants our offer named. */
    seedOutgoingGroupComposition(participants: readonly WaCallGroupParticipant[]): void;
    /**
     * Applies a `<group_update>`: first a reissued `<relay>`, whatever the roster says, then the
     * roster, then the rekey it asks of us. A stale roster is dropped but its rekey is not. A
     * roster listing somebody else connected is what connects a call we placed.
     */
    handleCallGroupUpdate(node: BinaryNode): Promise<void>;
    /**
     * Installs a group call key, from an `<enc_rekey>` or from our own rekey, and republishes
     * the keys and every sender's. A key equal to the one installed changes nothing; a call
     * that is no group's ignores it.
     */
    applyCallKey(callKey: Uint8Array, transactionId: number | null): Promise<void>;
    /**
     * Takes the sender of a `<terminate>` off a group call that goes on. Not a roster, so the
     * `transaction-id` the server orders rosters by does not move.
     */
    removeGroupParticipant(peerJid: string | undefined, reason: string | undefined): void;
    /** The plan's `group` section, once there is a key and a composition to derive it from. */
    private groupSection;
    /** The sending devices and their streams, derived once for everything one sync publishes. */
    private groupSenders;
    /** Republishes what a group call derives from its composition and key, together. */
    private syncGroupMedia;
    /** Maps each sender id back to its device, and its media entry to the sender id. */
    private syncGroupSenders;
    /** Forgets every device a roster change took off the call. */
    private forgetDepartedDevices;
    /**
     * Applies a `<video>` a group participant sent: its own camera, per device, ordered by its
     * own counter. None of the 1:1 upgrade handshake applies.
     */
    private applyGroupVideoState;
    /**
     * The server turned this group call into a video call: our receive path opens, the requester's
     * camera goes on, and a camera that stays off is announced as stopped.
     */
    private applyGroupVideoUpgrade;
    /**
     * Turns our camera on or off on a group call; a 1:1 call uses {@link requestVideoUpgrade}.
     * @throws on a 1:1 call, or when the send fails, leaving the camera as it was.
     */
    setVideoEnabled(enabled: boolean): Promise<void>;
    /**
     * Overrides whose video is asked of the SFU; `null` hands it back to the policy: every
     * camera that is on, at most four, once more than two are connected.
     */
    setVideoSubscriptions(subscriptions: readonly CallVideoSubscription[] | null): void;
    /**
     * A group sender's media started or stopped reaching us, as the media host reports it.
     * Edge-triggered: an unchanged state is not reported again.
     */
    handleSenderMedia(senderId: string, receiving: boolean): void;
    /** Whether a `<video>` fails to advance the sender's own counter past the last one seen. */
    private isStaleVideoState;
    /**
     * Asks the peer to turn this audio call into video, resolving with the outcome; no video
     * leaves until it accepts. A crossing request is answered instead, a second call joins the
     * first. @throws when the call is not active or already carries video.
     */
    requestVideoUpgrade(): Promise<WaVideoUpgradeResult>;
    /**
     * Accepts the peer's upgrade request: the accept, then our sender, then `Enabled`, our frames
     * held until the peer is ready. No-op when the peer has nothing outstanding.
     */
    acceptVideoUpgrade(): Promise<void>;
    /** Declines an upgrade the peer asked for. No-op when it asked for none. */
    rejectVideoUpgrade(): Promise<void>;
    /** Withdraws the request this side sent. No-op when nothing is in flight. */
    cancelVideoUpgrade(): Promise<void>;
    /** Subscribes the peer's video streams, the receive path having just opened. */
    private onVideoReceivePathOpened;
    /** The media has no relay leg left and nothing reopens one: the call ends as a hangup. */
    private onRelayLost;
    /** Media is flowing: a call still connecting goes active and declares its mute state. */
    private onMediaActive;
    /** An event from the host that carries this call's media elsewhere. */
    handleMediaEvent(event: WaCallMediaEvent): void;
    /** The whole media plan as it stands, or `null` when the media runs in this process. */
    getMediaSnapshot(): WaCallMediaMessage | null;
    /**
     * `reason` is the `<terminate>` reason. Only an incoming call keeps the elsewhere reasons:
     * on an outgoing one `accepted_elsewhere` comes from the peer's companions.
     */
    handleCallTerminate(reason?: string): void;
    cleanup(): void;
    /**
     * Sends one emoji reaction in-band on the media socket. Returns whether the first
     * packet left; a `false` does not lose it, the retransmission carries it.
     */
    sendReaction(reaction: string): boolean;
    private publishSsrcsAndKeys;
    /** The plan's `ssrcs`; on a group call every sender's streams, `group` when already derived. */
    private buildSsrcs;
    /** The SRTP keys of the call key: ours to send, the answering device's to receive. */
    private deriveKeys;
}
