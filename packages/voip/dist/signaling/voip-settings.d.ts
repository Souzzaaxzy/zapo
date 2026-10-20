import { type Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
/**
 * The per-call configuration the server sends in `<voip_settings>`, a JSON document whose values
 * mostly arrive as strings. The typed fields are every key this client applies, read once at
 * parse; a missing section, key or unexpected type reads as the default.
 */
export declare class WaVoipSettings {
    private readonly root;
    /** `vid_rc.disable_rtcp_remb`: the server turned RTCP REMB off for this call. */
    readonly disableRtcpRemb: boolean;
    /** `rc.rtcp_interval_ms`, positive only, else `null`. Only the audio profile carries it. */
    readonly rtcpIntervalMs: number | null;
    /** `encode.frame_ms`, the audio frame duration (`60` observed), positive only, else `null`. */
    readonly audioFrameMs: number | null;
    /** `rc.maxfpp`, most audio frames per packet (`2` observed), positive only, else `null`. */
    readonly audioMaxFramesPerPacket: number | null;
    /** `options.video_state_txn_id_recv_enforce`: inbound `<video>` txn ids are enforced. */
    readonly videoStateTxnRecvEnforce: boolean;
    /** `options.heartbeat_interval_s` in milliseconds, positive only, else `null`. */
    readonly heartbeatIntervalMs: number | null;
    /** `options.enable_app_data_stream`. */
    readonly appDataStream: boolean;
    /** `options.app_data_stream_version`, `0` when absent. */
    readonly appDataStreamVersion: number;
    /** `sframe.enable_sframe`. */
    readonly sframe: boolean;
    /** `sframe.enable_sframe_rx`. */
    readonly sframeRx: boolean;
    private constructor();
    /**
     * An instance from the decoded JSON, or `null` when the root is not an object.
     *
     * @throws the `JSON.parse` error when the text is not JSON.
     */
    static fromJson(text: string): WaVoipSettings | null;
    /** How many top-level sections there are, useful for logging only. */
    get sectionCount(): number;
    /** The raw leaf value, unnormalized, or `undefined` when it does not exist. */
    private leaf;
    private positiveNumber;
    /**
     * The boolean gate of the section, or `fallback` when the section, the key
     * or the shape of the value is not there.
     */
    getFlag(section: string, key: string, fallback: boolean): boolean;
    /**
     * The numeric parameter of the section, or `fallback` when the section, the
     * key or the shape of the value is not there.
     */
    getNumber(section: string, key: string, fallback: number): number;
    /** The string value exactly as the server wrote it, or `fallback` when it is not a string. */
    getText(section: string, key: string, fallback?: string | null): string | null;
}
/**
 * Reads the `<voip_settings>` of `node`, one of its children or grandchildren. Never throws:
 * an absent node, an unknown variant, bad base64 or bad JSON all return `null`.
 */
export declare function parseVoipSettings(node: BinaryNode, logger?: Logger): WaVoipSettings | null;
