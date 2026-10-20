import type { Logger } from 'zapo-js';
import type { BinaryNode } from 'zapo-js/transport';
import { type PeerScreenShare } from '../signaling/screen-share.js';
import type { WaVoipDeps } from '../types.js';
import { type CallInfo } from './call-state.js';
import type { WaCallPlanPublisher } from './WaCallPlanPublisher.js';
import type { WaCallStanzaSender } from './WaCallStanzaSender.js';
/** Where the in-call states the peers announce are reported. */
export interface WaCallAnnouncementsDelegate {
    emitState(call: CallInfo): void;
    emitPeerMute(call: CallInfo, muted: boolean, participantJid?: string): void;
    emitHandRaise(call: CallInfo, participantJid: string, raised: boolean): void;
    emitScreenShare(call: CallInfo, share: PeerScreenShare, participantJid?: string): void;
    emitMuteRequested?(call: CallInfo, participantJid: string, requestState: string): void;
}
export interface WaCallAnnouncementsOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly deps: Pick<WaVoipDeps, 'authClient'>;
    readonly stanzas: WaCallStanzaSender;
    readonly plan: WaCallPlanPublisher;
    readonly delegate: WaCallAnnouncementsDelegate;
    /** Where our in-call stanzas go. */
    readonly target: () => string;
    /** A peer's `<mute_v2>` arrived: the born-video sign that it can take our video. */
    readonly onPeerMuteAnnounced: () => void;
}
/** The in-call states each side announces: microphone, raised hand, screen share, mute requests. */
export declare class WaCallAnnouncements {
    private readonly info;
    private readonly logger;
    private readonly deps;
    private readonly stanzas;
    private readonly plan;
    private readonly delegate;
    private readonly target;
    private readonly onPeerMuteAnnounced;
    /** Whether the one post-active `<mute_v2>` declaration has gone out. */
    private initialMuteAnnounced;
    /** `screen_share_id` of the last start or stop sent; each one sent takes the next. */
    private screenShareId;
    constructor(options: WaCallAnnouncementsOptions);
    /** Mutes our capture and announces it; the media keeps sending silence on the same SSRC. */
    setMute(muted: boolean): void;
    /** Announces our microphone state once the call is active; the peer shows nothing until then. */
    announceInitialMute(): void;
    /** Raises or lowers our hand; the state moves only once the stanza left, else it rethrows. */
    setHandRaised(raised: boolean): Promise<void>;
    /**
     * Tells the peer our video stream now carries the screen, or no longer. @throws when the
     * send fails, or to start one while `videoSendActive` is false.
     */
    setScreenShare(sharing: boolean, videoSendActive: boolean): Promise<void>;
    /**
     * Records the microphone state a `<mute_v2>` announces; one from our own account, or a mute
     * request on a 1:1 call, is dropped.
     */
    handleMuteV2(node: BinaryNode, peerJid: string): void;
    /** Records the hand a stanza of either shape carried; one from our own account is dropped. */
    handleRaiseHand(node: BinaryNode, peerJid: string): void;
    /**
     * Records the screen-share state a `screen_share` or `screen` stanza carried, as `senderJid`'s;
     * nothing goes back.
     */
    handleScreenShare(node: BinaryNode, senderJid: string): void;
    /**
     * Re-announces our own state to the call when somebody arrives, since nothing else tells a
     * newcomer: our mute state always, our hand only while it is up. Video is not replayed.
     */
    rebroadcast(): void;
    /** A participant asked us to mute. Reported, never applied: muting is the app's call. */
    private handleMuteRequest;
    private muteV2Stanza;
}
