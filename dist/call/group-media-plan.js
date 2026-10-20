"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaCallDerivations = void 0;
exports.relayEndpointKey = relayEndpointKey;
exports.sameRelayEndpointSet = sameRelayEndpointSet;
exports.sameRelayCredentials = sameRelayCredentials;
exports.adoptedRelayTransport = adoptedRelayTransport;
exports.electRelayEndpoints = electRelayEndpoints;
exports.adoptableRelayEndpoints = adoptableRelayEndpoints;
exports.groupSenderDeviceJids = groupSenderDeviceJids;
exports.selfStreamLayers = selfStreamLayers;
exports.senderStreamsOf = senderStreamsOf;
exports.groupSenderId = groupSenderId;
exports.groupDevicePids = groupDevicePids;
exports.buildGroupSection = buildGroupSection;
exports.groupSendersOf = groupSendersOf;
exports.selectVideoSubscriptions = selectVideoSubscriptions;
const voip_media_1 = require("@zapo-js/voip-media");
const encryption_js_1 = require("../crypto/encryption.js");
const ssrc_js_1 = require("../crypto/ssrc.js");
const jid_js_1 = require("../jid.js");
const group_participants_js_1 = require("./group-participants.js");
/** Stream layers of the relay declaration; not the SSRC slots, which disagree on every value. */
const WA_STREAM_LAYER = Object.freeze({
    Audio: 0,
    VideoMain: 1,
    VideoSecondary: 2,
    AppData: 5
});
/** One stream's slots in declaration order: media, FEC, out-of-band NACK. */
const AUDIO_STREAM_SLOTS = [
    ssrc_js_1.WA_SSRC_SLOT.AUDIO.MAIN,
    ssrc_js_1.WA_SSRC_SLOT.AUDIO.FEC,
    ssrc_js_1.WA_SSRC_SLOT.AUDIO.OOB_NACK
];
const VIDEO_STREAM_SLOTS = [
    ssrc_js_1.WA_SSRC_SLOT.VIDEO.MAIN,
    ssrc_js_1.WA_SSRC_SLOT.VIDEO.FEC,
    ssrc_js_1.WA_SSRC_SLOT.VIDEO.OOB_NACK
];
/** The suffix a device's secondary video stream derives from: stream index 1. */
const SECONDARY_STREAM_SUFFIX = '_1';
/** Where a relay leg is dialled: the address alone, since a reissue re-mints the token. */
function relayEndpointKey(endpoint) {
    return `${endpoint.ip}|${endpoint.port}`;
}
function sameKeySet(current, next, keyOf) {
    const held = new Set(current.map(keyOf));
    const wanted = new Set(next.map(keyOf));
    if (held.size !== wanted.size)
        return false;
    for (const key of wanted) {
        if (!held.has(key))
            return false;
    }
    return true;
}
/** Whether two endpoint sets name the same addresses, order aside. */
function sameRelayEndpointSet(current, next) {
    return sameKeySet(current, next, relayEndpointKey);
}
/** What a leg registers with: its address and the token, auth token and key its descriptor names. */
function relayCredentialKey(endpoint) {
    return `${relayEndpointKey(endpoint)}|${endpoint.token}|${endpoint.authToken ?? ''}|${endpoint.key}`;
}
/** Whether two endpoint sets register the same way: same addresses under the same credentials. */
function sameRelayCredentials(current, next) {
    return sameKeySet(current, next, relayCredentialKey);
}
/**
 * How an adopted relay endpoint is dialled: over raw UDP when it carries no auth token, the
 * way a callee's reissue works; with one, over the ordinary 1:1 path and its ICE credential.
 */
function adoptedRelayTransport(endpoint) {
    return endpoint.authToken ? undefined : 'raw-udp';
}
/** One relay across its endpoints: `relay-id` and name repeat on every address of a node. */
function relayIdentityOf(endpoint) {
    return `${endpoint.relayId}|${endpoint.relayName ?? ''}`;
}
/**
 * Elects the relay with the lowest `c2r_rtt` among the dialable endpoints (ties keep the
 * first) and returns every dialable address of it; the runner-up is never dialled.
 */
function electRelayEndpoints(endpoints) {
    return electAmong((0, voip_media_1.dialableRelayEndpoints)(endpoints));
}
function electAmong(dialable) {
    if (dialable.length === 0)
        return [];
    let elected = dialable[0];
    for (const endpoint of dialable) {
        if ((endpoint.c2rRtt ?? Infinity) < (elected.c2rRtt ?? Infinity))
            elected = endpoint;
    }
    const identity = relayIdentityOf(elected);
    return dialable.filter((endpoint) => relayIdentityOf(endpoint) === identity);
}
/**
 * Every dialable relay of a reissued group descriptor, elected first and the rest by `c2r_rtt`,
 * each with all its addresses: the server may move the downlink to any of them, and a relay
 * with no leg cannot deliver. The media leg is still chosen by the relay layer.
 */
function adoptableRelayEndpoints(endpoints) {
    const dialable = (0, voip_media_1.dialableRelayEndpoints)(endpoints);
    const elected = electAmong(dialable);
    if (elected.length === 0)
        return [];
    const byRelay = new Map([[relayIdentityOf(elected[0]), []]]);
    const sorted = dialable.sort((a, b) => (a.c2rRtt ?? Infinity) - (b.c2rRtt ?? Infinity));
    for (const endpoint of sorted) {
        const identity = relayIdentityOf(endpoint);
        const relay = byRelay.get(identity);
        if (relay)
            relay.push(endpoint);
        else
            byRelay.set(identity, [endpoint]);
    }
    return [...byRelay.values()].flat();
}
/**
 * Every device sending into the call: all devices of every participant still on it, our own
 * account left out, each once. Not narrowed to `connected`, so media is ready before it flows.
 */
function groupSenderDeviceJids(composition, selfJid, accountKeyOf = (participant) => (0, jid_js_1.groupParticipantAccountKey)(participant.jid)) {
    const selfKey = selfJid ? (0, jid_js_1.groupParticipantAccountKey)(selfJid) : null;
    const devices = new Set();
    for (const participant of composition.participants) {
        if (selfKey !== null && accountKeyOf(participant) === selfKey)
            continue;
        if ((0, group_participants_js_1.isGroupParticipantLeaving)(participant))
            continue;
        for (const deviceJid of participant.devices)
            devices.add((0, jid_js_1.toDeviceJid)(deviceJid));
    }
    return [...devices];
}
function directSsrcOf(callId) {
    return (deviceJid, slot) => (0, ssrc_js_1.generateSecureSsrc)(callId, deviceJid, slot);
}
function ssrcsOf(ssrcOf, deviceJid, slots) {
    return slots.map((slot) => ssrcOf(deviceJid, slot));
}
function streamLayersOf(ssrcOf, selfDeviceJid) {
    return [
        { layer: WA_STREAM_LAYER.Audio, ssrcs: ssrcsOf(ssrcOf, selfDeviceJid, AUDIO_STREAM_SLOTS) },
        {
            layer: WA_STREAM_LAYER.VideoMain,
            ssrcs: ssrcsOf(ssrcOf, selfDeviceJid, VIDEO_STREAM_SLOTS)
        },
        {
            layer: WA_STREAM_LAYER.VideoSecondary,
            ssrcs: ssrcsOf(ssrcOf, `${selfDeviceJid}${SECONDARY_STREAM_SUFFIX}`, VIDEO_STREAM_SLOTS)
        },
        {
            layer: WA_STREAM_LAYER.AppData,
            ssrcs: ssrcsOf(ssrcOf, selfDeviceJid, [ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN])
        }
    ];
}
function streamsOfSender(ssrcOf, deviceJid, coversVideo) {
    const audio = ssrcsOf(ssrcOf, deviceJid, [...AUDIO_STREAM_SLOTS, ssrc_js_1.WA_SSRC_SLOT.APP_DATA.MAIN]);
    if (!coversVideo)
        return audio;
    return [
        ...audio,
        ...ssrcsOf(ssrcOf, deviceJid, VIDEO_STREAM_SLOTS),
        ...ssrcsOf(ssrcOf, `${deviceJid}${SECONDARY_STREAM_SUFFIX}`, VIDEO_STREAM_SLOTS)
    ];
}
function toSenderId(audioSsrc) {
    return audioSsrc.toString(16).padStart(8, '0');
}
/**
 * Our streams as the relay declaration lists them: audio, video main and video secondary
 * three positions each, whether or not video is on, then app data.
 */
function selfStreamLayers(callId, selfDeviceJid) {
    return streamLayersOf(directSsrcOf(callId), selfDeviceJid);
}
/**
 * Every stream of one sender the media accepts and keys, main audio first: the audio stack
 * and app data, plus both video layers once video is covered. Anything unlisted is dropped.
 */
function senderStreamsOf(callId, deviceJid, coversVideo) {
    return streamsOfSender(directSsrcOf(callId), deviceJid, coversVideo);
}
/** An opaque sender id: the device's main audio SSRC in hex, stable for the call. */
function groupSenderId(callId, deviceJid) {
    return toSenderId((0, ssrc_js_1.generateSecureSsrc)(callId, deviceJid, ssrc_js_1.WA_SSRC_SLOT.AUDIO.MAIN));
}
/** The `<device pid>` of each device jid the roster gave one, `:0` form; 0 is a pid. */
function groupDevicePids(composition) {
    const pids = new Map();
    for (const participant of composition.participants) {
        for (const [deviceJid, pid] of Object.entries(participant.devicePids ?? {})) {
            pids.set((0, jid_js_1.toDeviceJid)(deviceJid), pid);
        }
    }
    return pids;
}
function groupSectionOf(deviceJids, pids, videoSubscriptions, streamsOf, recvKeyOf) {
    const senders = deviceJids.map((deviceJid) => {
        const streams = streamsOf(deviceJid);
        const pid = pids.get(deviceJid);
        return {
            id: toSenderId(streams[0]),
            audio: streams[0],
            streams,
            recv: recvKeyOf(deviceJid),
            ...(pid !== undefined && { pid })
        };
    });
    return videoSubscriptions.length > 0 ? { senders, videoSubscriptions } : { senders };
}
/**
 * The plan's `group` section: one sender per device, keyed per device from the call key, with
 * its `<device pid>` when the roster gave one, and the video asked of the SFU.
 */
function buildGroupSection(callId, callKey, deviceJids, coversVideo, pids = new Map(), videoSubscriptions = []) {
    const ssrcOf = directSsrcOf(callId);
    return groupSectionOf(deviceJids, pids, videoSubscriptions, (deviceJid) => streamsOfSender(ssrcOf, deviceJid, coversVideo), (deviceJid) => (0, encryption_js_1.derivePerJidSrtpKey)(callKey, deviceJid));
}
/** Past this many entries a memo starts over; a long call with churn cannot grow it unbounded. */
const MAX_MEMOISED_SSRCS = 4096;
const MAX_MEMOISED_SRTP_KEYS = 512;
/**
 * One call's SSRC and per-device SRTP key derivations, each run once: both are pure in their
 * inputs, and a group call re-derives every sender on each roster, rekey and subscription change.
 */
class WaCallDerivations {
    constructor(callId) {
        this.callId = callId;
        this.ssrcs = new Map();
        this.srtpKeys = new Map();
        this.srtpKeysOf = null;
        this.ssrc = (deviceJid, slot) => {
            const key = `${deviceJid}|${slot}`;
            let ssrc = this.ssrcs.get(key);
            if (ssrc === undefined) {
                if (this.ssrcs.size >= MAX_MEMOISED_SSRCS)
                    this.ssrcs.clear();
                ssrc = (0, ssrc_js_1.generateSecureSsrc)(this.callId, deviceJid, slot);
                this.ssrcs.set(key, ssrc);
            }
            return ssrc;
        };
    }
    /** {@link derivePerJidSrtpKey}, memoised per device for the call key last asked about. */
    srtpKey(callKey, deviceJid) {
        if (callKey !== this.srtpKeysOf || this.srtpKeys.size >= MAX_MEMOISED_SRTP_KEYS) {
            this.srtpKeys = new Map();
            this.srtpKeysOf = callKey;
        }
        let keys = this.srtpKeys.get(deviceJid);
        if (keys === undefined) {
            keys = (0, encryption_js_1.derivePerJidSrtpKey)(callKey, deviceJid);
            this.srtpKeys.set(deviceJid, keys);
        }
        return keys;
    }
    /** See {@link selfStreamLayers}. */
    selfStreamLayers(selfDeviceJid) {
        return streamLayersOf(this.ssrc, selfDeviceJid);
    }
    /** See {@link senderStreamsOf}. */
    senderStreams(deviceJid, coversVideo) {
        return streamsOfSender(this.ssrc, deviceJid, coversVideo);
    }
    /** See {@link groupSenderId}. */
    senderId(deviceJid) {
        return toSenderId(this.ssrc(deviceJid, ssrc_js_1.WA_SSRC_SLOT.AUDIO.MAIN));
    }
    /** See {@link buildGroupSection}; `streamsOf` hands back streams already derived. */
    groupSection(callKey, deviceJids, streamsOf, pids, videoSubscriptions) {
        return groupSectionOf(deviceJids, pids, videoSubscriptions, streamsOf, (deviceJid) => this.srtpKey(callKey, deviceJid));
    }
}
exports.WaCallDerivations = WaCallDerivations;
/** The sending devices and their streams, each device's derived on first ask. */
function groupSendersOf(devices, derivations, coversVideo) {
    const streams = new Map();
    return {
        devices,
        streamsOf: (deviceJid) => {
            let found = streams.get(deviceJid);
            if (!found) {
                found = derivations.senderStreams(deviceJid, coversVideo);
                streams.set(deviceJid, found);
            }
            return found;
        }
    };
}
const MAX_VIDEO_SUBSCRIPTIONS = 4;
/** Video subscriptions are processed once more than this many participants are connected. */
const MIN_CONNECTED_FOR_VIDEO_SUBSCRIPTIONS = 2;
/**
 * Whose video to ask the SFU for: every sender whose camera is on, at the default quality, at
 * most four in roster order, and nobody while two or fewer participants are connected.
 */
function selectVideoSubscriptions(senders, connectedCount) {
    if (connectedCount <= MIN_CONNECTED_FOR_VIDEO_SUBSCRIPTIONS)
        return [];
    return senders
        .filter((sender) => sender.videoEnabled)
        .slice(0, MAX_VIDEO_SUBSCRIPTIONS)
        .map((sender) => ({ senderId: sender.senderId, quality: voip_media_1.WA_VIDEO_QUALITY.Default }));
}
