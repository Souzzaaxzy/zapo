"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaRemoteCallMedia = exports.WaLocalCallMedia = void 0;
exports.toCompanionModelSource = toCompanionModelSource;
const promises_1 = require("node:fs/promises");
const util_1 = require("zapo-js/util");
const voip_media_1 = require("@zapo-js/voip-media");
const node_1 = require("@zapo-js/voip-media/node");
const WaAudioEngine_js_1 = require("../media/WaAudioEngine.js");
/** The group sections and raw UDP legs, which a group call needs from its media host. */
const GROUP_HOST_FEATURES = [
    voip_media_1.WA_CALL_MEDIA_FEATURE_GROUP,
    voip_media_1.WA_CALL_MEDIA_FEATURE_RAW_UDP
];
/** What the plane in this process applies; its video subscriptions stay off. */
const LOCAL_HOST_FEATURES = [
    ...GROUP_HOST_FEATURES,
    voip_media_1.WA_CALL_MEDIA_FEATURE_GROUP_ATTRIBUTION
];
/**
 * The Companion weights as the media takes them: bytes as they are, a path as a loader that reads
 * the file once, on the first call that asks, and shares that read with every call after.
 */
function toCompanionModelSource(model) {
    if (typeof model !== 'string')
        return model;
    let read = null;
    return () => {
        read ?? (read = (0, promises_1.readFile)(model).then((bytes) => (0, util_1.toBytesView)(bytes), (err) => {
            read = null;
            throw err;
        }));
        return read;
    };
}
/**
 * Media carried in this process: a plane on the Node host, clocked and fed by the audio
 * engine, whose one capture clock runs from the warmup silence into the real source.
 */
class WaLocalCallMedia {
    constructor(options) {
        this.featuresAnnounced = false;
        const { events, logger } = options;
        this.events = events;
        this.audio = new WaAudioEngine_js_1.WaAudioEngine({ logger: logger.child({ component: 'audio-engine' }) });
        this.plane = new voip_media_1.WaCallMediaPlane({
            ...node_1.nodeMediaHost,
            logger,
            useOriginalRelayPort: options.useOriginalRelayPort,
            mlowCompanionModel: options.mlowCompanionModel,
            mlowRed: options.mlowRed,
            // Relays the plan marks raw UDP need the factory even when the rest go over WebRTC.
            createRawUdpLeg: (legOptions) => new node_1.WaRawUdpLeg(legOptions),
            rawUdpLegs: options.useRawUdpTransport ? 'all' : 'required',
            onActive: () => {
                this.audio.startPlayback();
                this.audio.startCapture();
                events.onActive();
            },
            onRelayLost: (reason) => events.onRelayLost(reason),
            onRelayAnswered: (name, rttMs) => events.onRelayAnswered(name, rttMs),
            onReaction: (reaction, senderId) => events.onReaction(reaction, senderId),
            onInboundVideoRtp: (packet) => events.onInboundVideoRtp(packet),
            onInboundVideo: (frame) => events.onInboundVideo(frame),
            onSenderMedia: (senderId, receiving) => events.onSenderMedia?.(senderId, receiving),
            onSenderAudio: events.onSenderAudio
                ? (senderId, pcm) => events.onSenderAudio?.(senderId, pcm.slice())
                : undefined
        });
        this.audio.setAudioSender({
            sendCapturedAudio: (pcm, capturedAtMs) => this.plane.pushCapture(pcm, capturedAtMs)
        });
        this.audio.setPlayoutSource((out) => this.plane.pullPlayout(out));
        // The engine reuses its buffer, so a listener gets a copy; no listener, no copy.
        this.audio.setPlaybackSink((pcm) => {
            if (events.wantsInboundAudio?.() === false)
                return;
            events.onInboundAudio(pcm.slice());
        });
        this.audio.setOnAudioFinished(() => events.onOutboundAudioFinished());
    }
    start() {
        if (!this.featuresAnnounced) {
            this.featuresAnnounced = true;
            this.events.onHostFeatures?.(LOCAL_HOST_FEATURES);
        }
        return this.plane.start();
    }
    async apply(update) {
        await this.plane.apply(update);
        // The warmup clock runs before the flow; the flow keeps it and swaps in the real source.
        if (this.plane.isWarmingUp && !this.plane.isFlowing) {
            this.audio.startSilenceCapture();
        }
    }
    stop() {
        this.audio.setOnAudioFinished(null);
        this.audio.setPlaybackSink(null);
        this.audio.stop();
        this.plane.stop();
    }
    sendReaction(reaction) {
        return this.plane.sendReaction(reaction);
    }
    sendVideoFrame(data, timestampUs) {
        return this.plane.sendVideoFrame(data, timestampUs);
    }
    loadAudio(audioPath) {
        return this.audio.loadAudioFile(audioPath);
    }
    setExternalAudioMode(enabled) {
        this.audio.setExternalMode(enabled);
    }
    feedLiveAudio(data) {
        return this.audio.feedExternalAudio(data);
    }
    getLiveBufferMs() {
        return this.audio.getLiveBufferMs();
    }
    handleEvent() {
        throw new Error('this call carries its media locally; there is no remote host to hear from');
    }
    snapshot() {
        return null;
    }
}
exports.WaLocalCallMedia = WaLocalCallMedia;
/**
 * Media carried by a host elsewhere: the plan leaves through
 * {@link WaCallMediaLinkEvents.onPlan} and the host's events come back via {@link handleEvent}.
 */
class WaRemoteCallMedia {
    constructor(callId, events, logger) {
        this.active = false;
        this.stopped = false;
        /** What the host said it applies; `null` until it says, or until it shows it never will. */
        this.hostFeatures = null;
        this.groupPublished = false;
        this.groupUnsupportedReported = false;
        this.events = events;
        this.logger = logger;
        this.sequencer = new voip_media_1.WaCallMediaMessageSequencer(callId);
    }
    start() {
        return Promise.resolve();
    }
    apply(update) {
        if (!this.stopped) {
            this.events.onPlan(this.sequencer.next(update));
            if (update.group) {
                this.groupPublished = true;
                this.reportGroupUnsupported();
            }
        }
        return Promise.resolve();
    }
    stop() {
        this.stopped = true;
    }
    /** Reactions ride the media, so the host carrying it is the one that sends them. */
    sendReaction() {
        return false;
    }
    /** Video rides the media, so the host carrying it is the one that sends it. */
    sendVideoFrame() {
        return 0;
    }
    loadAudio() {
        return Promise.reject(localAudioUnavailable());
    }
    setExternalAudioMode() {
        throw localAudioUnavailable();
    }
    feedLiveAudio() {
        throw localAudioUnavailable();
    }
    getLiveBufferMs() {
        return 0;
    }
    handleEvent(event) {
        if (this.stopped)
            return;
        if (event.type === 'host') {
            this.recordHostFeatures(event.features);
            return;
        }
        // A host that knows the `host` event sends it before anything else.
        if (this.hostFeatures === null)
            this.recordHostFeatures([]);
        switch (event.type) {
            case 'active':
                if (this.active)
                    return;
                this.active = true;
                if (!event.reportsRelayAnswers)
                    this.assumeDialledRelaysAnswered();
                this.events.onActive();
                return;
            case 'relay_lost':
                this.events.onRelayLost(event.reason);
                return;
            case 'relay_answered':
                this.events.onRelayAnswered(event.name, event.rttMs);
                return;
            case 'reaction':
                this.events.onReaction(event.reaction, event.senderId);
                return;
            case 'sender_media':
                this.events.onSenderMedia?.(event.senderId, event.receiving);
                return;
            case 'resync':
                this.events.onPlan(this.sequencer.snapshot());
                return;
        }
    }
    snapshot() {
        return this.sequencer.snapshot();
    }
    recordHostFeatures(features) {
        this.hostFeatures = features;
        this.events.onHostFeatures?.(features);
        this.reportGroupUnsupported();
    }
    /** Once per call: a group plan published to a host that cannot apply it. */
    reportGroupUnsupported() {
        const features = this.hostFeatures;
        if (this.groupUnsupportedReported || !this.groupPublished || !features)
            return;
        const missing = GROUP_HOST_FEATURES.filter((feature) => !features.includes(feature));
        if (missing.length === 0)
            return;
        this.groupUnsupportedReported = true;
        this.logger?.warn('media host cannot carry a group call', { missing, features });
        this.events.onError?.(new Error(`the media host lacks ${missing.join(', ')}, which a group call needs`));
    }
    /** A host older than `relay_answered` names no relay: once its media is up, all we dial count. */
    assumeDialledRelaysAnswered() {
        const endpoints = this.sequencer.snapshot().plan.relays?.endpoints ?? [];
        for (const endpoint of (0, voip_media_1.dialableRelayEndpoints)(endpoints)) {
            if (endpoint.name)
                this.events.onRelayAnswered(endpoint.name);
        }
    }
}
exports.WaRemoteCallMedia = WaRemoteCallMedia;
function localAudioUnavailable() {
    return new Error('this call carries its media remotely; its audio is fed on the media host');
}
