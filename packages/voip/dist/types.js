"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUDIO_CONFIG = exports.EndCallReason = exports.CallMediaType = exports.CallDirection = exports.CallState = void 0;
var CallState;
(function (CallState) {
    CallState["Initiating"] = "initiating";
    CallState["Ringing"] = "ringing";
    CallState["IncomingRinging"] = "incoming_ringing";
    CallState["Connecting"] = "connecting";
    CallState["Active"] = "active";
    CallState["OnHold"] = "on_hold";
    CallState["Ended"] = "ended";
})(CallState || (exports.CallState = CallState = {}));
var CallDirection;
(function (CallDirection) {
    CallDirection["Outgoing"] = "outgoing";
    CallDirection["Incoming"] = "incoming";
})(CallDirection || (exports.CallDirection = CallDirection = {}));
var CallMediaType;
(function (CallMediaType) {
    CallMediaType["Audio"] = "audio";
    CallMediaType["Video"] = "video";
})(CallMediaType || (exports.CallMediaType = CallMediaType = {}));
var EndCallReason;
(function (EndCallReason) {
    EndCallReason["UserEnded"] = "user_ended";
    EndCallReason["Declined"] = "declined";
    EndCallReason["Timeout"] = "timeout";
    EndCallReason["Busy"] = "busy";
    EndCallReason["Cancelled"] = "cancelled";
    EndCallReason["Failed"] = "failed";
    /** The call had a media path and lost it, with no leg left to carry it. */
    EndCallReason["RelayLost"] = "relay_lost";
    /** The server refused our offer; the peers were told `setup_failed`. */
    EndCallReason["SetupFailed"] = "setup_failed";
    /**
     * The server took this side off a group call that goes on, because the others stopped
     * receiving its media (`user_invisible`). It can be joined again with `joinCall`.
     */
    EndCallReason["Invisible"] = "invisible";
    EndCallReason["DoNotDisturb"] = "do_not_disturb";
    EndCallReason["Unknown"] = "unknown";
    /** Another device of this account answered the incoming call. */
    EndCallReason["AcceptedElsewhere"] = "accepted_elsewhere";
    /** Another device of this account declined the incoming call. */
    EndCallReason["RejectedElsewhere"] = "rejected_elsewhere";
})(EndCallReason || (exports.EndCallReason = EndCallReason = {}));
exports.DEFAULT_AUDIO_CONFIG = {
    sampleRate: 16000,
    captureChunkSize: 960,
    playbackOutputSize: 960,
    intervalMs: 60
};
