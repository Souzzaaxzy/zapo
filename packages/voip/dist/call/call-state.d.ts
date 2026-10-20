import type { Logger } from 'zapo-js';
import type { PeerScreenShare } from '../signaling/screen-share.js';
import type { WaVoipSettings } from '../signaling/voip-settings.js';
import { CallDirection, CallMediaType, CallState, type CallTransition, type EndCallReason, type PeerVideoStateChange, type RelayData } from '../types.js';
import type { WaGroupComposition } from './group-participants.js';
/**
 * What one remote device last announced about its media, keyed by its device jid in the form
 * stanzas arrive from (device 0 bare). Filled on 1:1 calls too.
 */
export interface WaCallParticipantMedia {
    readonly deviceJid: string;
    /** Its media sender id on a group call, see `groupSenderId`. */
    senderId?: string;
    audioMuted?: boolean;
    video?: PeerVideoStateChange;
    screenShare?: PeerScreenShare;
    /** Whether its media is reaching us, from the media host; absent until it says. */
    receiving?: boolean;
}
export interface CallStateData {
    state: CallState;
    connectedAt?: Date;
    acceptedAt?: Date;
    endedAt?: Date;
    audioMuted: boolean;
    /**
     * Microphone state the peer last announced for itself, `undefined` until it does. An
     * observation, not a local state, so it is recorded directly and not as a transition.
     */
    peerAudioMuted?: boolean;
    videoOff: boolean;
    /** Local raise-hand state; the remote hands are {@link CallInfo.raisedHands}. */
    handRaised: boolean;
    /**
     * Whether this side is sharing right now (the peer's is
     * {@link CallInfo.peerScreenShare}). While set, the call's one video stream carries
     * the screen and not a camera.
     */
    screenSharing: boolean;
    silenced?: boolean;
    /** Incoming call waiting for a free slot; cannot accept until unblocked. */
    acceptBlocked?: boolean;
    endReason?: EndCallReason;
    durationSecs?: number;
}
export declare class CallInfo {
    callId: string;
    peerJid: string;
    callCreator: string;
    direction: CallDirection;
    mediaType: CallMediaType;
    stateData: CallStateData;
    createdAt: Date;
    /** `group-jid` of the offer: set on a group call, which is what makes it one. */
    groupJid?: string;
    /**
     * `joinable` of the offer: others may still join, so one participant's `<terminate>` is not
     * the end of the call; see {@link decideJoinableTerminate}. Independent of {@link groupJid}.
     */
    joinable: boolean;
    isOffline: boolean;
    callerPn?: string;
    encryptionKey?: Uint8Array;
    relayData?: RelayData;
    electedRelayIdx?: number;
    /**
     * Remote participants whose hand is raised, keyed by the device JID the stanza arrived
     * from. An entry survives until that participant lowers the hand.
     */
    readonly raisedHands: Set<string>;
    /**
     * The last `<voip_settings>` applied, the offer's or a later upgrade's; absent when none
     * was readable.
     */
    voipSettings?: WaVoipSettings;
    /**
     * Last screen-share state the peer reported. Updated in place, so a `voip_call_state`
     * listener reads the current value without subscribing to `voip_call_screen_share`.
     */
    peerScreenShare?: PeerScreenShare;
    /**
     * Last video state the peer announced, from its `<video>`. Absent until it sends one,
     * which only happens on a mid-call change - a call negotiated as video never does.
     */
    peerVideoState?: PeerVideoStateChange;
    /**
     * Who is on a group call: seeded from the offer and replaced whole by every roster that
     * folds in. Absent on a 1:1 call.
     */
    groupComposition?: WaGroupComposition;
    /** Per remote device, what it last announced about its media. See {@link WaCallParticipantMedia}. */
    readonly participantMedia: Map<string, WaCallParticipantMedia>;
    /** Media sender id to the device jid it stands for (device 0 bare), on a group call. */
    readonly groupSenders: Map<string, string>;
    private constructor();
    static newOutgoing(callId: string, peerJid: string, ourJid: string, mediaType: CallMediaType): CallInfo;
    /**
     * A group call we join after its ring, from what was kept of it: no offer comes, our accept
     * to the call is the join. It starts ringing so {@link WaCallMediaSession.acceptCall} takes it.
     */
    static newGroupJoin(callId: string, callCreator: string, mediaType: CallMediaType, groupJid?: string): CallInfo;
    static newIncoming(callId: string, peerJid: string, callCreator: string, callerPn: string | undefined, mediaType: CallMediaType): CallInfo;
    get isInitiator(): boolean;
    get isActive(): boolean;
    get isRinging(): boolean;
    get isEnded(): boolean;
    /**
     * A group call: one the manager marked as such, naming a group, or carrying a roster. A 1:1
     * call that grows into a group offers the newcomer a roster without `group-jid`. `joinable`
     * says nothing: WA Web marks its 1:1 offers joinable too.
     */
    get isGroupCall(): boolean;
    set isGroupCall(value: boolean);
    private markedGroupCall;
    /**
     * A voice chat: a group call placed `lightweight`, which announces `<silence>` instead of
     * media and never rings. Its members are silent on purpose until someone speaks, so a quiet
     * sender must not be reported invisible; see {@link WaGroupLiveness}.
     */
    isLightweight: boolean;
    get canAccept(): boolean;
    get isAcceptBlocked(): boolean;
    get canReject(): boolean;
    applyTransition(transition: CallTransition): void;
}
export declare class InvalidTransition extends Error {
    currentState: string;
    attempted: string;
    constructor(currentState: string, attempted: string);
}
/**
 * The `<terminate>` reason the server sends when a group call is over for everybody, once its
 * last member left; clients never send it. Any other terminate is one participant leaving.
 */
export declare const WA_GROUP_CALL_ENDED_REASON = "group_call_ended";
/** What a `<terminate>` does to the call it names. */
export declare const WA_TERMINATE_DECISION: Readonly<{
    readonly End: "end";
    /** Keep the call and let the consumer see a terminate arrived. */
    readonly Ignore: "ignore";
    /** Keep the call and report nothing. */
    readonly IgnoreSilently: "ignore_silently";
    /** Keep the call and take the sender off its composition. */
    readonly RemoveParticipant: "remove_participant";
}>;
export type WaTerminateDecision = (typeof WA_TERMINATE_DECISION)[keyof typeof WA_TERMINATE_DECISION];
/**
 * What a `<terminate>` does to a joinable group call: an accept in flight is kept whatever the
 * reason, a handover reason ends it, an active call loses only the sender, the rest is kept.
 */
export declare function decideJoinableTerminate(call: CallInfo, reason: string | undefined): WaTerminateDecision;
/** The media entry of a device, created on first sight; `null` once tracking is full. */
export declare function trackParticipantMedia(info: CallInfo, deviceJid: string, logger: Logger): WaCallParticipantMedia | null;
