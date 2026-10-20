"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_TERMINATE_DECISION = exports.WA_GROUP_CALL_ENDED_REASON = exports.InvalidTransition = exports.CallInfo = void 0;
exports.decideJoinableTerminate = decideJoinableTerminate;
exports.trackParticipantMedia = trackParticipantMedia;
const types_js_1 = require("../types.js");
class CallInfo {
    constructor(init) {
        /**
         * Remote participants whose hand is raised, keyed by the device JID the stanza arrived
         * from. An entry survives until that participant lowers the hand.
         */
        this.raisedHands = new Set();
        /** Per remote device, what it last announced about its media. See {@link WaCallParticipantMedia}. */
        this.participantMedia = new Map();
        /** Media sender id to the device jid it stands for (device 0 bare), on a group call. */
        this.groupSenders = new Map();
        this.markedGroupCall = false;
        this.callId = init.callId;
        this.peerJid = init.peerJid;
        this.callCreator = init.callCreator;
        this.direction = init.direction;
        this.mediaType = init.mediaType;
        this.stateData = init.stateData;
        this.createdAt = new Date();
        this.joinable = false;
        this.isOffline = false;
        this.callerPn = init.callerPn;
    }
    static newOutgoing(callId, peerJid, ourJid, mediaType) {
        return new CallInfo({
            callId,
            peerJid,
            callCreator: ourJid,
            direction: types_js_1.CallDirection.Outgoing,
            mediaType,
            stateData: {
                state: types_js_1.CallState.Initiating,
                audioMuted: false,
                videoOff: mediaType !== types_js_1.CallMediaType.Video,
                handRaised: false,
                screenSharing: false
            }
        });
    }
    /**
     * A group call we join after its ring, from what was kept of it: no offer comes, our accept
     * to the call is the join. It starts ringing so {@link WaCallMediaSession.acceptCall} takes it.
     */
    static newGroupJoin(callId, callCreator, mediaType, groupJid) {
        const call = CallInfo.newIncoming(callId, callCreator, callCreator, undefined, mediaType);
        call.groupJid = groupJid;
        call.joinable = true;
        call.isGroupCall = true;
        return call;
    }
    static newIncoming(callId, peerJid, callCreator, callerPn, mediaType) {
        return new CallInfo({
            callId,
            peerJid,
            callCreator,
            direction: types_js_1.CallDirection.Incoming,
            mediaType,
            callerPn,
            stateData: {
                state: types_js_1.CallState.IncomingRinging,
                audioMuted: false,
                videoOff: mediaType !== types_js_1.CallMediaType.Video,
                handRaised: false,
                screenSharing: false
            }
        });
    }
    get isInitiator() {
        return this.direction === types_js_1.CallDirection.Outgoing;
    }
    get isActive() {
        return this.stateData.state === types_js_1.CallState.Active;
    }
    get isRinging() {
        return (this.stateData.state === types_js_1.CallState.Ringing ||
            this.stateData.state === types_js_1.CallState.IncomingRinging);
    }
    get isEnded() {
        return this.stateData.state === types_js_1.CallState.Ended;
    }
    /**
     * A group call: one the manager marked as such, naming a group, or carrying a roster. A 1:1
     * call that grows into a group offers the newcomer a roster without `group-jid`. `joinable`
     * says nothing: WA Web marks its 1:1 offers joinable too.
     */
    get isGroupCall() {
        return (this.markedGroupCall ||
            this.groupJid !== undefined ||
            this.groupComposition !== undefined);
    }
    set isGroupCall(value) {
        this.markedGroupCall = value;
    }
    get canAccept() {
        return this.stateData.state === types_js_1.CallState.IncomingRinging && !this.stateData.acceptBlocked;
    }
    get isAcceptBlocked() {
        return this.stateData.acceptBlocked === true;
    }
    get canReject() {
        return (this.stateData.state === types_js_1.CallState.IncomingRinging ||
            this.stateData.state === types_js_1.CallState.Ringing);
    }
    applyTransition(transition) {
        const s = this.stateData;
        switch (transition.type) {
            case 'offer_sent':
                if (s.state !== types_js_1.CallState.Initiating) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Ringing;
                break;
            case 'offer_received':
                if (s.state !== types_js_1.CallState.Initiating) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.IncomingRinging;
                s.silenced = transition.silenced;
                break;
            case 'remote_accepted':
                if (s.state !== types_js_1.CallState.Ringing) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Connecting;
                s.acceptedAt = new Date();
                break;
            case 'local_accepted':
                if (s.state !== types_js_1.CallState.IncomingRinging) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Connecting;
                s.acceptedAt = new Date();
                break;
            case 'remote_rejected':
                if (s.state !== types_js_1.CallState.Ringing) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Ended;
                s.endedAt = new Date();
                s.endReason = transition.reason;
                break;
            case 'local_rejected':
                if (s.state !== types_js_1.CallState.IncomingRinging) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Ended;
                s.endedAt = new Date();
                s.endReason = transition.reason;
                break;
            case 'media_connected':
                if (s.state !== types_js_1.CallState.Connecting) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Active;
                s.connectedAt = new Date();
                s.videoOff = this.mediaType !== types_js_1.CallMediaType.Video;
                break;
            case 'terminated':
                if (s.state === types_js_1.CallState.Ended) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                if ((s.state === types_js_1.CallState.Active || s.state === types_js_1.CallState.OnHold) &&
                    s.connectedAt) {
                    s.durationSecs = Math.floor((Date.now() - s.connectedAt.getTime()) / 1000);
                }
                s.state = types_js_1.CallState.Ended;
                s.endedAt = new Date();
                s.endReason = transition.reason;
                s.handRaised = false;
                s.screenSharing = false;
                this.raisedHands.clear();
                this.participantMedia.clear();
                break;
            case 'hold':
                if (s.state !== types_js_1.CallState.Active) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.OnHold;
                break;
            case 'resume':
                if (s.state !== types_js_1.CallState.OnHold) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.state = types_js_1.CallState.Active;
                break;
            case 'audio_mute_changed':
                if (s.state !== types_js_1.CallState.Active) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.audioMuted = transition.muted;
                break;
            case 'video_state_changed':
                if (s.state !== types_js_1.CallState.Active) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.videoOff = transition.off;
                break;
            case 'hand_raise_changed':
                if (s.state !== types_js_1.CallState.Active) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.handRaised = transition.raised;
                break;
            case 'screen_share_changed':
                if (s.state !== types_js_1.CallState.Active) {
                    throw new InvalidTransition(s.state, transition.type);
                }
                s.screenSharing = transition.sharing;
                break;
            default:
                throw new InvalidTransition(s.state, transition.type);
        }
    }
}
exports.CallInfo = CallInfo;
class InvalidTransition extends Error {
    constructor(currentState, attempted) {
        super(`invalid transition '${attempted}' in state '${currentState}'`);
        this.name = 'InvalidTransition';
        this.currentState = currentState;
        this.attempted = attempted;
    }
}
exports.InvalidTransition = InvalidTransition;
/** `<terminate>` reasons that hand the call to another device of this account. */
const HANDED_OVER_REASONS = new Set([
    'accepted_elsewhere',
    'rejected_elsewhere',
    'device_switch'
]);
/**
 * The `<terminate>` reason the server sends when a group call is over for everybody, once its
 * last member left; clients never send it. Any other terminate is one participant leaving.
 */
exports.WA_GROUP_CALL_ENDED_REASON = 'group_call_ended';
/** What a `<terminate>` does to the call it names. */
exports.WA_TERMINATE_DECISION = Object.freeze({
    End: 'end',
    /** Keep the call and let the consumer see a terminate arrived. */
    Ignore: 'ignore',
    /** Keep the call and report nothing. */
    IgnoreSilently: 'ignore_silently',
    /** Keep the call and take the sender off its composition. */
    RemoveParticipant: 'remove_participant'
});
/**
 * What a `<terminate>` does to a joinable group call: an accept in flight is kept whatever the
 * reason, a handover reason ends it, an active call loses only the sender, the rest is kept.
 */
function decideJoinableTerminate(call, reason) {
    if (!call.joinable || !call.isGroupCall || call.isEnded)
        return exports.WA_TERMINATE_DECISION.End;
    const state = call.stateData.state;
    const terminateReason = reason ? reason : null;
    if (terminateReason === exports.WA_GROUP_CALL_ENDED_REASON)
        return exports.WA_TERMINATE_DECISION.End;
    if (state === types_js_1.CallState.Connecting && call.direction === types_js_1.CallDirection.Incoming) {
        return exports.WA_TERMINATE_DECISION.Ignore;
    }
    if (terminateReason !== null && HANDED_OVER_REASONS.has(terminateReason)) {
        return exports.WA_TERMINATE_DECISION.End;
    }
    if (state === types_js_1.CallState.Active || state === types_js_1.CallState.OnHold) {
        return exports.WA_TERMINATE_DECISION.RemoveParticipant;
    }
    if (terminateReason === null && state === types_js_1.CallState.IncomingRinging) {
        return exports.WA_TERMINATE_DECISION.IgnoreSilently;
    }
    return exports.WA_TERMINATE_DECISION.Ignore;
}
/** One entry per device the stanzas name: 32 connected participants, five devices each. */
const MAX_TRACKED_PARTICIPANT_MEDIA = 160;
/** The media entry of a device, created on first sight; `null` once tracking is full. */
function trackParticipantMedia(info, deviceJid, logger) {
    const media = info.participantMedia;
    const existing = media.get(deviceJid);
    if (existing)
        return existing;
    if (media.size >= MAX_TRACKED_PARTICIPANT_MEDIA) {
        logger.debug('participant media tracking full, state dropped', {
            callId: info.callId,
            participantJid: deviceJid
        });
        return null;
    }
    const entry = { deviceJid };
    media.set(deviceJid, entry);
    return entry;
}
