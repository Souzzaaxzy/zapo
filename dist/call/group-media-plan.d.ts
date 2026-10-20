import { type SrtpKeyingMaterial, type WaCallMediaGroup, type WaCallMediaStreamLayer, type WaCallMediaVideoSubscription } from '@zapo-js/voip-media';
import type { RelayEndpoint } from '../types.js';
import { type WaCallGroupParticipant, type WaGroupComposition } from './group-participants.js';
/** Where a relay leg is dialled: the address alone, since a reissue re-mints the token. */
export declare function relayEndpointKey(endpoint: Pick<RelayEndpoint, 'ip' | 'port'>): string;
/** Whether two endpoint sets name the same addresses, order aside. */
export declare function sameRelayEndpointSet(current: readonly Pick<RelayEndpoint, 'ip' | 'port'>[], next: readonly Pick<RelayEndpoint, 'ip' | 'port'>[]): boolean;
/** Whether two endpoint sets register the same way: same addresses under the same credentials. */
export declare function sameRelayCredentials(current: readonly Pick<RelayEndpoint, 'ip' | 'port' | 'token' | 'authToken' | 'key'>[], next: readonly Pick<RelayEndpoint, 'ip' | 'port' | 'token' | 'authToken' | 'key'>[]): boolean;
/**
 * How an adopted relay endpoint is dialled: over raw UDP when it carries no auth token, the
 * way a callee's reissue works; with one, over the ordinary 1:1 path and its ICE credential.
 */
export declare function adoptedRelayTransport(endpoint: Pick<RelayEndpoint, 'authToken'>): 'raw-udp' | undefined;
/**
 * Elects the relay with the lowest `c2r_rtt` among the dialable endpoints (ties keep the
 * first) and returns every dialable address of it; the runner-up is never dialled.
 */
export declare function electRelayEndpoints(endpoints: readonly RelayEndpoint[]): RelayEndpoint[];
/**
 * Every dialable relay of a reissued group descriptor, elected first and the rest by `c2r_rtt`,
 * each with all its addresses: the server may move the downlink to any of them, and a relay
 * with no leg cannot deliver. The media leg is still chosen by the relay layer.
 */
export declare function adoptableRelayEndpoints(endpoints: readonly RelayEndpoint[]): RelayEndpoint[];
/**
 * Every device sending into the call: all devices of every participant still on it, our own
 * account left out, each once. Not narrowed to `connected`, so media is ready before it flows.
 */
export declare function groupSenderDeviceJids(composition: WaGroupComposition, selfJid: string, accountKeyOf?: (participant: WaCallGroupParticipant) => string): string[];
/** One SSRC of a device's stream: `(deviceJid, slot)` for a fixed call. */
type SsrcOf = (deviceJid: string, slot: number) => number;
/**
 * Our streams as the relay declaration lists them: audio, video main and video secondary
 * three positions each, whether or not video is on, then app data.
 */
export declare function selfStreamLayers(callId: string, selfDeviceJid: string): WaCallMediaStreamLayer[];
/**
 * Every stream of one sender the media accepts and keys, main audio first: the audio stack
 * and app data, plus both video layers once video is covered. Anything unlisted is dropped.
 */
export declare function senderStreamsOf(callId: string, deviceJid: string, coversVideo: boolean): number[];
/** An opaque sender id: the device's main audio SSRC in hex, stable for the call. */
export declare function groupSenderId(callId: string, deviceJid: string): string;
/** The `<device pid>` of each device jid the roster gave one, `:0` form; 0 is a pid. */
export declare function groupDevicePids(composition: WaGroupComposition): Map<string, number>;
/**
 * The plan's `group` section: one sender per device, keyed per device from the call key, with
 * its `<device pid>` when the roster gave one, and the video asked of the SFU.
 */
export declare function buildGroupSection(callId: string, callKey: Uint8Array, deviceJids: readonly string[], coversVideo: boolean, pids?: ReadonlyMap<string, number>, videoSubscriptions?: readonly WaCallMediaVideoSubscription[]): WaCallMediaGroup;
/**
 * One call's SSRC and per-device SRTP key derivations, each run once: both are pure in their
 * inputs, and a group call re-derives every sender on each roster, rekey and subscription change.
 */
export declare class WaCallDerivations {
    private readonly callId;
    private readonly ssrcs;
    private srtpKeys;
    private srtpKeysOf;
    constructor(callId: string);
    readonly ssrc: SsrcOf;
    /** {@link derivePerJidSrtpKey}, memoised per device for the call key last asked about. */
    srtpKey(callKey: Uint8Array, deviceJid: string): SrtpKeyingMaterial;
    /** See {@link selfStreamLayers}. */
    selfStreamLayers(selfDeviceJid: string): WaCallMediaStreamLayer[];
    /** See {@link senderStreamsOf}. */
    senderStreams(deviceJid: string, coversVideo: boolean): number[];
    /** See {@link groupSenderId}. */
    senderId(deviceJid: string): string;
    /** See {@link buildGroupSection}; `streamsOf` hands back streams already derived. */
    groupSection(callKey: Uint8Array, deviceJids: readonly string[], streamsOf: (deviceJid: string) => number[], pids: ReadonlyMap<string, number>, videoSubscriptions: readonly WaCallMediaVideoSubscription[]): WaCallMediaGroup;
}
/** A group call's sending devices with their streams, shared by one sync's sections. */
export interface GroupSenders {
    readonly devices: readonly string[];
    readonly streamsOf: (deviceJid: string) => number[];
}
/** The sending devices and their streams, each device's derived on first ask. */
export declare function groupSendersOf(devices: readonly string[], derivations: WaCallDerivations, coversVideo: boolean): GroupSenders;
/**
 * Whose video to ask the SFU for: every sender whose camera is on, at the default quality, at
 * most four in roster order, and nobody while two or fewer participants are connected.
 */
export declare function selectVideoSubscriptions(senders: readonly {
    readonly senderId: string;
    readonly videoEnabled: boolean;
}[], connectedCount: number): WaCallMediaVideoSubscription[];
export {};
