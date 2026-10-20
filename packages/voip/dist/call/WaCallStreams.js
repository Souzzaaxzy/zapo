"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaCallStreams = void 0;
const protocol_1 = require("zapo-js/protocol");
const util_1 = require("zapo-js/util");
const ssrc_js_1 = require("../crypto/ssrc.js");
const jid_js_1 = require("../jid.js");
const types_js_1 = require("../types.js");
const call_jids_js_1 = require("./call-jids.js");
const media_plan_js_1 = require("./media-plan.js");
/** Memory guard on a set fed straight from remote stanzas, one per peer device. */
const MAX_TRACKED_PEER_APP_DATA_SSRCS = 32;
/** The SSRC sets and versioned SRTP keys one call publishes, derived per device. */
class WaCallStreams {
    constructor(options) {
        /** The SSRC lists of the plan as last derived; published whole as `ssrcs` on any change. */
        this.selfStreamSsrcs = [];
        this.peerAudioSsrc = 0;
        this.peerStreamSsrcs = [];
        this.peerVideoStreamSsrcs = [];
        /** App-data SSRCs of the peer's devices: inbound app data is recognized by SSRC alone. */
        this.peerAppDataSsrcs = new Set();
        /** Bumped when the SRTP keys change, so the media rebuilds its contexts only then. */
        this.keyEpoch = 0;
        this.lastKeys = null;
        /** Our own device jid, as the SSRC derivation takes it. */
        this.selfDeviceJid = '';
        this.info = options.info;
        this.logger = options.logger;
        this.deps = options.deps;
        this.derivations = options.derivations;
    }
    /** Our own device jid, empty until the media is initialized or the ack names it. */
    get deviceJid() {
        return this.selfDeviceJid;
    }
    /** Derives the streams of a call about to start, ours and the peer's. */
    initialize(selfLid, peerJid) {
        const selfDeviceJid = (0, jid_js_1.toDeviceJid)(selfLid);
        const peerDeviceJid = (0, jid_js_1.toDeviceJid)(peerJid);
        this.selfDeviceJid = selfDeviceJid;
        const relaySlots = this.relaySlots;
        this.selfStreamSsrcs = relaySlots.map((slot) => this.ssrcOf(selfDeviceJid, slot));
        this.peerStreamSsrcs = relaySlots.map((slot) => this.ssrcOf(peerDeviceJid, slot));
        if (this.info.mediaType === types_js_1.CallMediaType.Audio) {
            const peerBase = (0, protocol_1.toUserJid)(peerJid);
            const peerDevices = (this.info.relayData?.participantJids || [])
                .filter((jid) => (0, protocol_1.toUserJid)(jid) === peerBase)
                .map((jid) => (0, jid_js_1.toDeviceJid)(jid));
            this.peerStreamSsrcs = this.audioStreamsOf([peerDeviceJid, ...peerDevices]);
            this.trackPeerAppDataSsrcs([peerDeviceJid, ...peerDevices]);
        }
        else {
            this.trackPeerAppDataSsrcs([peerDeviceJid]);
        }
        this.peerAudioSsrc = this.peerStreamSsrcs[0];
        this.peerVideoStreamSsrcs = this.peerVideoStreamsOf((0, jid_js_1.toDeviceJid)(this.info.peerJid));
        this.logger.debug('call media initialized', {
            callId: this.info.callId,
            selfSsrc: `0x${this.selfStreamSsrcs[0].toString(16).toUpperCase()}`,
            peerSsrc: `0x${this.peerAudioSsrc.toString(16).toUpperCase()}`
        });
    }
    /** Our accept took the call: the offer's sender is the peer we hear. */
    subscribeAnswered(acceptedPeerDeviceJid) {
        this.peerAudioSsrc = this.ssrcOf(acceptedPeerDeviceJid);
        this.peerVideoStreamSsrcs = this.peerVideoStreamsOf(acceptedPeerDeviceJid);
    }
    /** The peer accepted a call we placed: its answering device's streams replace the others. */
    subscribeAccepted(acceptedPeerDeviceJid, acceptingDeviceJid) {
        // A stream of the peer already seen on the wire outranks this, and the media keeps it.
        this.peerAudioSsrc = this.ssrcOf(acceptedPeerDeviceJid);
        this.logger.debug('accept ssrc assigned', {
            callId: this.info.callId,
            jid: acceptedPeerDeviceJid,
            ssrc: `0x${this.peerAudioSsrc.toString(16)}`
        });
        this.peerStreamSsrcs = this.relaySlots.map((slot) => this.ssrcOf(acceptedPeerDeviceJid, slot));
        if (this.info.mediaType === types_js_1.CallMediaType.Audio) {
            const peerBase = (0, protocol_1.toUserJid)(acceptingDeviceJid);
            const peerDevices = (this.info.relayData?.participantJids || [])
                .filter((jid) => (0, protocol_1.toUserJid)(jid) === peerBase)
                .map((jid) => (0, jid_js_1.toDeviceJid)(jid));
            this.peerStreamSsrcs = this.audioStreamsOf([acceptedPeerDeviceJid, ...peerDevices]);
            this.trackPeerAppDataSsrcs([acceptedPeerDeviceJid, ...peerDevices]);
        }
        else {
            this.trackPeerAppDataSsrcs([acceptedPeerDeviceJid]);
        }
        this.peerVideoStreamSsrcs = this.peerVideoStreamsOf(acceptedPeerDeviceJid);
    }
    /** The participants the ack of our offer lists: our device as the relay names it, and the peer's. */
    subscribeFromOfferAck(participantJids, acceptedByJid) {
        const ourJid = (0, call_jids_js_1.selfJidOf)(this.deps);
        const ourBase = ourJid ? (0, protocol_1.toUserJid)(ourJid) : '';
        const ourDeviceJid = (0, jid_js_1.toDeviceJid)(this.relayDeviceJid());
        this.selfDeviceJid = ourDeviceJid;
        // Until an accept names the answering device, every device of the peer is subscribed.
        const peerDevices = acceptedByJid
            ? [(0, jid_js_1.toDeviceJid)(acceptedByJid)]
            : Array.from(new Set(participantJids
                .filter((jid) => (0, protocol_1.toUserJid)(jid) !== ourBase)
                .map((jid) => (0, jid_js_1.toDeviceJid)(jid))));
        if (this.info.mediaType === types_js_1.CallMediaType.Video) {
            this.selfStreamSsrcs = ssrc_js_1.WA_VIDEO_CALL_SSRC_SLOTS.map((slot) => this.ssrcOf(ourDeviceJid, slot));
            if (peerDevices.length > 0) {
                this.peerStreamSsrcs = Array.from(new Set(peerDevices.flatMap((jid) => ssrc_js_1.WA_VIDEO_CALL_SSRC_SLOTS.map((slot) => this.ssrcOf(jid, slot)))));
            }
        }
        else if (!acceptedByJid && peerDevices.length > 0) {
            this.peerStreamSsrcs = this.audioStreamsOf(peerDevices);
        }
        if (acceptedByJid)
            this.peerAudioSsrc = this.ssrcOf(peerDevices[0]);
        this.trackPeerAppDataSsrcs(peerDevices);
    }
    /** Subscribes the peer's video streams, on a call whose video receiving just opened. */
    openPeerVideo(peerDeviceJid) {
        this.peerVideoStreamSsrcs = this.peerVideoStreamsOf(peerDeviceJid);
    }
    /** The plan's `ssrcs`; with `group`, every sender's streams in place of the 1:1 sets. */
    build(group) {
        const self = this.selfDeviceJid;
        const base = {
            selfAudio: self ? this.ssrcOf(self, ssrc_js_1.WA_SSRC_SLOT.AUDIO.MAIN) : 0,
            selfVideo: self ? this.ssrcOf(self, ssrc_js_1.WA_SSRC_SLOT.VIDEO.MAIN) : 0,
            selfAppData: self ? this.ssrcOf(self, ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN) : 0,
            selfStreams: [...this.selfStreamSsrcs],
            selfVideoStreams: self ? this.videoOnlyStreamsOf(self) : [],
            peerAudio: this.peerAudioSsrc,
            peerStreams: [...this.peerStreamSsrcs],
            peerVideoStreams: [...this.peerVideoStreamSsrcs],
            peerAppData: [...this.peerAppDataSsrcs]
        };
        if (!group)
            return base;
        // Every sender's streams and app data, in place of the 1:1 sets.
        const peerStreams = new Set();
        const peerAppData = [];
        for (const deviceJid of group.devices) {
            for (const ssrc of group.streamsOf(deviceJid))
                peerStreams.add(ssrc);
            peerAppData.push(this.ssrcOf(deviceJid, ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN));
        }
        return {
            ...base,
            peerStreams: peerStreams.size > 0 ? [...peerStreams] : base.peerStreams,
            peerAppData: peerAppData.length > 0 ? peerAppData : base.peerAppData,
            selfLayers: this.derivations.selfStreamLayers(self)
        };
    }
    /** Keeps the last epoch for unchanged keys, so the media's SRTP contexts keep their state. */
    versionKeys(send, recv) {
        const last = this.lastKeys;
        if (last && (0, media_plan_js_1.samePlanValue)(last.send, send) && (0, media_plan_js_1.samePlanValue)(last.recv, recv)) {
            return last;
        }
        this.lastKeys = { epoch: ++this.keyEpoch, send, recv };
        return this.lastKeys;
    }
    /**
     * Derives the SRTP keys from the call key: ours to send, `peerJid`'s to receive. `null`
     * without a call key or on failure, leaving the media's keys as they were.
     */
    deriveKeys(peerJid) {
        const callKey = this.info.encryptionKey;
        if (!callKey) {
            this.logger.debug('no call_key, srtp not initialized', { callId: this.info.callId });
            return null;
        }
        const ourDeviceJid = (0, jid_js_1.toDeviceJid)(this.relayDeviceJid());
        if (!ourDeviceJid) {
            this.logger.debug('no own jid, srtp not initialized', { callId: this.info.callId });
            return null;
        }
        const peerDeviceJid = (0, jid_js_1.toDeviceJid)(peerJid);
        try {
            const keys = this.versionKeys(this.derivations.srtpKey(callKey, ourDeviceJid), this.derivations.srtpKey(callKey, peerDeviceJid));
            this.logger.debug('srtp per-jid keys initialized', {
                callId: this.info.callId,
                sendJid: ourDeviceJid,
                recvJid: peerDeviceJid
            });
            return keys;
        }
        catch (err) {
            this.logger.debug('srtp key derivation failed', {
                callId: this.info.callId,
                message: (0, util_1.toError)(err).message
            });
            return null;
        }
    }
    /** Our device as the relay lists it among the participants, else our account jid. */
    relayDeviceJid() {
        return (0, jid_js_1.relayListedDeviceJid)((0, call_jids_js_1.selfJidOf)(this.deps), this.info.relayData?.participantJids || []);
    }
    get relaySlots() {
        return this.info.mediaType === types_js_1.CallMediaType.Video
            ? ssrc_js_1.WA_VIDEO_CALL_SSRC_SLOTS
            : ssrc_js_1.WA_AUDIO_CALL_SSRC_SLOTS;
    }
    ssrcOf(deviceJid, slot = 0) {
        return this.derivations.ssrc(deviceJid, slot);
    }
    /** The audio and app-data streams of every device listed, each once. */
    audioStreamsOf(deviceJids) {
        return Array.from(new Set(deviceJids.flatMap((jid) => [
            this.ssrcOf(jid, ssrc_js_1.WA_SSRC_SLOT.AUDIO.MAIN),
            this.ssrcOf(jid, ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN)
        ])));
    }
    /** The streams video adds to a device's registration: {@link VIDEO_ONLY_SSRC_SLOTS}. */
    videoOnlyStreamsOf(deviceJid) {
        return media_plan_js_1.VIDEO_ONLY_SSRC_SLOTS.map((slot) => this.ssrcOf(deviceJid, slot));
    }
    /** The peer's three video streams, subscribed to once its video can arrive. */
    peerVideoStreamsOf(peerDeviceJid) {
        return [ssrc_js_1.WA_SSRC_SLOT.VIDEO.MAIN, ssrc_js_1.WA_SSRC_SLOT.VIDEO.FEC, ssrc_js_1.WA_SSRC_SLOT.VIDEO.OOB_NACK].map((slot) => this.ssrcOf(peerDeviceJid, slot));
    }
    trackPeerAppDataSsrcs(deviceJids) {
        for (const jid of deviceJids) {
            if (!jid)
                continue;
            if (this.peerAppDataSsrcs.size >= MAX_TRACKED_PEER_APP_DATA_SSRCS)
                break;
            this.peerAppDataSsrcs.add(this.ssrcOf(jid, ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN));
        }
    }
}
exports.WaCallStreams = WaCallStreams;
