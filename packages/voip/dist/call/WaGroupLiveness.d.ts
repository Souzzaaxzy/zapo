import type { Logger } from 'zapo-js';
import { type CallInfo } from './call-state.js';
import type { WaCallStanzaSender } from './WaCallStanzaSender.js';
import type { WaGroupRoster } from './WaGroupRoster.js';
/** Where a sender's media edge is reported. */
export interface WaGroupLivenessDelegate {
    emitParticipantMedia?(call: CallInfo, participantJid: string, receiving: boolean): void;
}
export interface WaGroupLivenessOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly now: () => number;
    readonly stanzas: WaCallStanzaSender;
    readonly roster: Pick<WaGroupRoster, 'accountKeyOf' | 'selfAccountKey'>;
    readonly delegate: WaGroupLivenessDelegate;
}
/** Keeps a connected group call alive and its members' visibility honest: heartbeat and sweep. */
export declare class WaGroupLiveness {
    private readonly info;
    private readonly logger;
    private readonly now;
    private readonly stanzas;
    private readonly roster;
    private readonly delegate;
    /** Since when we have been waiting on each connected group sender's media, by device. */
    private readonly senderWaitingSince;
    private readonly invisibleReported;
    private invisibleSweep;
    private heartbeatTimer;
    constructor(options: WaGroupLivenessOptions);
    /**
     * A group sender's media started or stopped reaching us, as the media host reports it.
     * Edge-triggered: an unchanged state is not reported again.
     */
    handleSenderMedia(senderId: string, receiving: boolean): void;
    /** Forgets what was tracked of a device that left, `key` its addressed form. */
    forget(key: string, deviceJid: string): void;
    /** Sends the call a `<heartbeat>` now and on every interval while this group call lasts. */
    startHeartbeat(): void;
    /** Starts checking, on a group call, for members nobody hears. */
    startSweep(): void;
    /** Stops the sweep, then the heartbeat. */
    stop(): void;
    /**
     * Reports invisible, once, each connected member none of whose devices was heard for
     * {@link PEER_INVISIBLE_AFTER_MS}; nobody while nobody at all is heard, our own path down.
     *
     * A voice chat is exempt: its members announce `<silence>` and stay quiet until they speak, so
     * silence says nothing about them. Reporting one would have the server expel a member who is
     * simply not talking, which is what makes a voice chat drop the people who joined it.
     */
    private sweepInvisibleSenders;
    private hearsAnySender;
    private reportPeerInvisible;
    private sendHeartbeat;
}
