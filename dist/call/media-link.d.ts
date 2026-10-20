import type { Logger } from 'zapo-js';
import { type InboundVideoFrame, type InboundVideoRtpPacket, type MLowCompanionModelSource, type MLowRedOptions, type WaCallMediaEvent, type WaCallMediaMessage, type WaCallMediaPlanUpdate, type WaCallReaction } from '@zapo-js/voip-media';
/** What a session hears back from wherever its media runs. */
export interface WaCallMediaLinkEvents {
    /** Media started flowing: the call is accepted and a relay leg is up. */
    onActive(): void;
    onRelayLost(reason: string): void;
    /** A relay answered one of our legs for the first time; `rttMs` when the media measured one. */
    onRelayAnswered(name: string, rttMs?: number): void;
    /** `senderId` names the group sender the reaction came from, when the host knows it. */
    onReaction(reaction: WaCallReaction, senderId?: string): void;
    onInboundAudio(pcm: Float32Array): void;
    /** Whether anything takes {@link onInboundAudio} right now; absent means always. */
    wantsInboundAudio?(): boolean;
    onInboundVideoRtp(packet: InboundVideoRtpPacket): void;
    onInboundVideo(frame: InboundVideoFrame): void;
    onOutboundAudioFinished(): void;
    /** A plan change for a host elsewhere to apply; only a remote link emits it. */
    onPlan(message: WaCallMediaMessage): void;
    /**
     * What the media host can apply. A local link names its own on start; a remote host older
     * than the `host` event is reported with none once it sends anything else.
     */
    onHostFeatures?(features: readonly string[]): void;
    /** A media problem the call carries on through, for `voip_call_error`. */
    onError?(error: Error): void;
    /** A group sender's media started or stopped arriving; see `WaCallMediaPlaneEvents.onSenderMedia`. */
    onSenderMedia?(senderId: string, receiving: boolean): void;
    /**
     * One group sender's decoded audio before the mix, a copy; local link only. Leave it out
     * when nothing listens, or every frame is copied for nobody.
     */
    onSenderAudio?(senderId: string, pcm: Float32Array): void;
}
/**
 * What a session talks to about media: the session publishes the plan, and the link
 * decides whether it runs in this process or on a host elsewhere.
 */
export interface WaCallMediaLink {
    /** Readies the media side; the local link loads the codec. */
    start(): Promise<void>;
    apply(update: WaCallMediaPlanUpdate): Promise<void>;
    stop(): void;
    sendReaction(reaction: string): boolean;
    sendVideoFrame(data: Uint8Array, timestampUs: number): number;
    loadAudio(audioPath: string): Promise<void>;
    setExternalAudioMode(enabled: boolean): void;
    feedLiveAudio(data: Float32Array): number;
    getLiveBufferMs(): number;
    /** An event from the remote host; the local link has none to take. */
    handleEvent(event: WaCallMediaEvent): void;
    /** The whole plan as it stands, for a remote host that joins late or lost track. */
    snapshot(): WaCallMediaMessage | null;
}
/**
 * The Companion weights as the media takes them: bytes as they are, a path as a loader that reads
 * the file once, on the first call that asks, and shares that read with every call after.
 */
export declare function toCompanionModelSource(model: Uint8Array | ArrayBuffer | string | undefined): MLowCompanionModelSource | undefined;
interface WaLocalCallMediaOptions {
    readonly logger: Logger;
    readonly events: WaCallMediaLinkEvents;
    readonly useOriginalRelayPort: boolean;
    readonly useRawUdpTransport: boolean;
    readonly mlowCompanionModel?: MLowCompanionModelSource;
    readonly mlowRed?: boolean | MLowRedOptions;
}
/**
 * Media carried in this process: a plane on the Node host, clocked and fed by the audio
 * engine, whose one capture clock runs from the warmup silence into the real source.
 */
export declare class WaLocalCallMedia implements WaCallMediaLink {
    private readonly plane;
    private readonly audio;
    private readonly events;
    private featuresAnnounced;
    constructor(options: WaLocalCallMediaOptions);
    start(): Promise<void>;
    apply(update: WaCallMediaPlanUpdate): Promise<void>;
    stop(): void;
    sendReaction(reaction: string): boolean;
    sendVideoFrame(data: Uint8Array, timestampUs: number): number;
    loadAudio(audioPath: string): Promise<void>;
    setExternalAudioMode(enabled: boolean): void;
    feedLiveAudio(data: Float32Array): number;
    getLiveBufferMs(): number;
    handleEvent(): void;
    snapshot(): null;
}
/**
 * Media carried by a host elsewhere: the plan leaves through
 * {@link WaCallMediaLinkEvents.onPlan} and the host's events come back via {@link handleEvent}.
 */
export declare class WaRemoteCallMedia implements WaCallMediaLink {
    private readonly events;
    private readonly logger;
    private readonly sequencer;
    private active;
    private stopped;
    /** What the host said it applies; `null` until it says, or until it shows it never will. */
    private hostFeatures;
    private groupPublished;
    private groupUnsupportedReported;
    constructor(callId: string, events: WaCallMediaLinkEvents, logger?: Logger);
    start(): Promise<void>;
    apply(update: WaCallMediaPlanUpdate): Promise<void>;
    stop(): void;
    /** Reactions ride the media, so the host carrying it is the one that sends them. */
    sendReaction(): boolean;
    /** Video rides the media, so the host carrying it is the one that sends it. */
    sendVideoFrame(): number;
    loadAudio(): Promise<void>;
    setExternalAudioMode(): void;
    feedLiveAudio(): number;
    getLiveBufferMs(): number;
    handleEvent(event: WaCallMediaEvent): void;
    snapshot(): WaCallMediaMessage;
    private recordHostFeatures;
    /** Once per call: a group plan published to a host that cannot apply it. */
    private reportGroupUnsupported;
    /** A host older than `relay_answered` names no relay: once its media is up, all we dial count. */
    private assumeDialledRelaysAnswered;
}
export {};
