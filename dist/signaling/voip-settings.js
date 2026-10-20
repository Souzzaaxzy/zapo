"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaVoipSettings = void 0;
exports.parseVoipSettings = parseVoipSettings;
const zapo_js_1 = require("zapo-js");
const transport_1 = require("zapo-js/transport");
const util_1 = require("zapo-js/util");
const VOIP_SETTINGS_TAG = 'voip_settings';
/** The only known value of this attribute is `1`; any other is a variant with no known decoding. */
const UNCOMPRESSED_ATTR = 'uncompressed';
const VIDEO_RATE_CONTROL_SECTION = 'vid_rc';
const RATE_CONTROL_SECTION = 'rc';
const DISABLE_RTCP_REMB_KEY = 'disable_rtcp_remb';
const RTCP_INTERVAL_MS_KEY = 'rtcp_interval_ms';
const ENCODE_SECTION = 'encode';
const FRAME_MS_KEY = 'frame_ms';
const MAX_FRAMES_PER_PACKET_KEY = 'maxfpp';
const OPTIONS_SECTION = 'options';
const VIDEO_STATE_TXN_RECV_ENFORCE_KEY = 'video_state_txn_id_recv_enforce';
const HEARTBEAT_INTERVAL_KEY = 'heartbeat_interval_s';
const ENABLE_APP_DATA_STREAM_KEY = 'enable_app_data_stream';
const APP_DATA_STREAM_VERSION_KEY = 'app_data_stream_version';
const SFRAME_SECTION = 'sframe';
const ENABLE_SFRAME_KEY = 'enable_sframe';
const ENABLE_SFRAME_RX_KEY = 'enable_sframe_rx';
const OPEN_BRACE = 0x7b;
const SPACE = 0x20;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
/** Whether the text opens a JSON object after leading whitespace, without copying it. */
function looksLikeJsonObject(text) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === SPACE || code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN) {
            continue;
        }
        return code === OPEN_BRACE;
    }
    return false;
}
/** `"1"`/`"0"`/`"true"`/`"false"` (or a real boolean or number) as a boolean; anything else is `null`. */
function toFlag(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value !== 0 : null;
    if (typeof value !== 'string')
        return null;
    const text = value.trim().toLowerCase();
    if (text === '1' || text === 'true')
        return true;
    if (text === '0' || text === 'false')
        return false;
    return null;
}
/** One section of the JSON, or `null` when the name does not point at an object. */
function toSection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value;
}
/**
 * The per-call configuration the server sends in `<voip_settings>`, a JSON document whose values
 * mostly arrive as strings. The typed fields are every key this client applies, read once at
 * parse; a missing section, key or unexpected type reads as the default.
 */
class WaVoipSettings {
    constructor(root) {
        this.root = root;
        this.disableRtcpRemb = this.getFlag(VIDEO_RATE_CONTROL_SECTION, DISABLE_RTCP_REMB_KEY, false);
        this.rtcpIntervalMs = this.positiveNumber(RATE_CONTROL_SECTION, RTCP_INTERVAL_MS_KEY);
        this.audioFrameMs = this.positiveNumber(ENCODE_SECTION, FRAME_MS_KEY);
        this.audioMaxFramesPerPacket = this.positiveNumber(RATE_CONTROL_SECTION, MAX_FRAMES_PER_PACKET_KEY);
        this.videoStateTxnRecvEnforce = this.getFlag(OPTIONS_SECTION, VIDEO_STATE_TXN_RECV_ENFORCE_KEY, false);
        const heartbeatSeconds = this.positiveNumber(OPTIONS_SECTION, HEARTBEAT_INTERVAL_KEY);
        this.heartbeatIntervalMs = heartbeatSeconds === null ? null : heartbeatSeconds * 1000;
        this.appDataStream = this.getFlag(OPTIONS_SECTION, ENABLE_APP_DATA_STREAM_KEY, false);
        this.appDataStreamVersion = this.getNumber(OPTIONS_SECTION, APP_DATA_STREAM_VERSION_KEY, 0);
        this.sframe = this.getFlag(SFRAME_SECTION, ENABLE_SFRAME_KEY, false);
        this.sframeRx = this.getFlag(SFRAME_SECTION, ENABLE_SFRAME_RX_KEY, false);
    }
    /**
     * An instance from the decoded JSON, or `null` when the root is not an object.
     *
     * @throws the `JSON.parse` error when the text is not JSON.
     */
    static fromJson(text) {
        const root = toSection(JSON.parse(text));
        return root ? new WaVoipSettings(root) : null;
    }
    /** How many top-level sections there are, useful for logging only. */
    get sectionCount() {
        return Object.keys(this.root).length;
    }
    /** The raw leaf value, unnormalized, or `undefined` when it does not exist. */
    leaf(section, key) {
        const bucket = toSection(this.root[section]);
        return bucket ? bucket[key] : undefined;
    }
    positiveNumber(section, key) {
        const value = this.getNumber(section, key, 0);
        return value > 0 ? value : null;
    }
    /**
     * The boolean gate of the section, or `fallback` when the section, the key
     * or the shape of the value is not there.
     */
    getFlag(section, key, fallback) {
        return toFlag(this.leaf(section, key)) ?? fallback;
    }
    /**
     * The numeric parameter of the section, or `fallback` when the section, the
     * key or the shape of the value is not there.
     */
    getNumber(section, key, fallback) {
        return (0, util_1.tryAsNumber)(this.leaf(section, key)) ?? fallback;
    }
    /** The string value exactly as the server wrote it, or `fallback` when it is not a string. */
    getText(section, key, fallback = null) {
        const value = this.leaf(section, key);
        return typeof value === 'string' ? value : fallback;
    }
}
exports.WaVoipSettings = WaVoipSettings;
/** The `<voip_settings>` node on `node` itself, on a child, or on a grandchild. */
function findVoipSettingsNode(node) {
    if (node.tag === VOIP_SETTINGS_TAG)
        return node;
    const direct = (0, transport_1.findNodeChild)(node, VOIP_SETTINGS_TAG);
    if (direct)
        return direct;
    for (const child of (0, transport_1.getNodeChildren)(node)) {
        const nested = (0, transport_1.findNodeChild)(child, VOIP_SETTINGS_TAG);
        if (nested)
            return nested;
    }
    return null;
}
/** The JSON text of the node content, given as a string or bytes, base64 or already JSON. */
function decodeSettingsText(content) {
    const raw = typeof content === 'string'
        ? content
        : content instanceof Uint8Array
            ? util_1.TEXT_DECODER.decode(content)
            : null;
    if (raw === null)
        return null;
    if (looksLikeJsonObject(raw))
        return raw;
    const encoded = raw.trim();
    if (encoded.length === 0)
        return null;
    return util_1.TEXT_DECODER.decode((0, util_1.base64ToBytes)(encoded));
}
/**
 * Reads the `<voip_settings>` of `node`, one of its children or grandchildren. Never throws:
 * an absent node, an unknown variant, bad base64 or bad JSON all return `null`.
 */
function parseVoipSettings(node, logger) {
    const log = logger ?? (0, zapo_js_1.createNoopLogger)();
    const settingsNode = findVoipSettingsNode(node);
    if (!settingsNode)
        return null;
    const uncompressed = settingsNode.attrs?.[UNCOMPRESSED_ATTR];
    if (uncompressed !== undefined && toFlag(uncompressed) !== true) {
        log.debug('voip settings variant has no known decoder, ignored', { uncompressed });
        return null;
    }
    try {
        const text = decodeSettingsText(settingsNode.content);
        if (text === null) {
            log.debug('voip settings node carries no readable content');
            return null;
        }
        const settings = WaVoipSettings.fromJson(text);
        if (!settings) {
            log.debug('voip settings payload is not a json object');
            return null;
        }
        return settings;
    }
    catch (err) {
        log.debug('voip settings payload rejected', { message: (0, util_1.toError)(err).message });
        return null;
    }
}
