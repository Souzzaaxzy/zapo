import type { Logger } from 'zapo-js';
import type { WaCallMediaKeys, WaCallMediaSsrcs } from '@zapo-js/voip-media';
import { type WaVoipDeps } from '../types.js';
import type { CallInfo } from './call-state.js';
import type { GroupSenders, WaCallDerivations } from './group-media-plan.js';
export interface WaCallStreamsOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly deps: Pick<WaVoipDeps, 'authClient'>;
    readonly derivations: WaCallDerivations;
}
/** The SSRC sets and versioned SRTP keys one call publishes, derived per device. */
export declare class WaCallStreams {
    private readonly info;
    private readonly logger;
    private readonly deps;
    private readonly derivations;
    /** The SSRC lists of the plan as last derived; published whole as `ssrcs` on any change. */
    private selfStreamSsrcs;
    private peerAudioSsrc;
    private peerStreamSsrcs;
    private peerVideoStreamSsrcs;
    /** App-data SSRCs of the peer's devices: inbound app data is recognized by SSRC alone. */
    private readonly peerAppDataSsrcs;
    /** Bumped when the SRTP keys change, so the media rebuilds its contexts only then. */
    private keyEpoch;
    private lastKeys;
    /** Our own device jid, as the SSRC derivation takes it. */
    private selfDeviceJid;
    constructor(options: WaCallStreamsOptions);
    /** Our own device jid, empty until the media is initialized or the ack names it. */
    get deviceJid(): string;
    /** Derives the streams of a call about to start, ours and the peer's. */
    initialize(selfLid: string, peerJid: string): void;
    /** Our accept took the call: the offer's sender is the peer we hear. */
    subscribeAnswered(acceptedPeerDeviceJid: string): void;
    /** The peer accepted a call we placed: its answering device's streams replace the others. */
    subscribeAccepted(acceptedPeerDeviceJid: string, acceptingDeviceJid: string): void;
    /** The participants the ack of our offer lists: our device as the relay names it, and the peer's. */
    subscribeFromOfferAck(participantJids: readonly string[], acceptedByJid: string | null): void;
    /** Subscribes the peer's video streams, on a call whose video receiving just opened. */
    openPeerVideo(peerDeviceJid: string): void;
    /** The plan's `ssrcs`; with `group`, every sender's streams in place of the 1:1 sets. */
    build(group?: GroupSenders): WaCallMediaSsrcs;
    /** Keeps the last epoch for unchanged keys, so the media's SRTP contexts keep their state. */
    versionKeys(send: WaCallMediaKeys['send'], recv: WaCallMediaKeys['recv']): WaCallMediaKeys;
    /**
     * Derives the SRTP keys from the call key: ours to send, `peerJid`'s to receive. `null`
     * without a call key or on failure, leaving the media's keys as they were.
     */
    deriveKeys(peerJid: string): WaCallMediaKeys | null;
    /** Our device as the relay lists it among the participants, else our account jid. */
    relayDeviceJid(): string;
    private get relaySlots();
    private ssrcOf;
    /** The audio and app-data streams of every device listed, each once. */
    private audioStreamsOf;
    /** The streams video adds to a device's registration: {@link VIDEO_ONLY_SSRC_SLOTS}. */
    private videoOnlyStreamsOf;
    /** The peer's three video streams, subscribed to once its video can arrive. */
    private peerVideoStreamsOf;
    private trackPeerAppDataSsrcs;
}
