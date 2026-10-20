import type { EventEmitter } from 'node:events';
import type { EndCallReason } from '../types.js';
import type { CallInfo } from './call-state.js';
import type { WaCallMediaSessionDelegate } from './WaCallMediaSession.js';
import type { WaOutOfOrderStanzas } from './WaOutOfOrderStanzas.js';
export interface WaCallReporterOptions {
    /** Read on every event, so a listener or `emit` swapped in later still applies. */
    readonly emitter: Pick<EventEmitter, 'emit' | 'listenerCount'>;
    readonly endedCalls: Pick<WaOutOfOrderStanzas, 'rememberEnded'>;
    readonly participantAudio: boolean;
}
/** Turns what the calls report into the manager's events, keeping unannounced calls silent. */
export declare class WaCallReporter {
    private readonly emitter;
    private readonly endedCalls;
    private readonly participantAudio;
    /** Calls the app knows of: an outgoing one from its start, an incoming one once announced. */
    private readonly announced;
    constructor(options: WaCallReporterOptions);
    markAnnounced(call: CallInfo): void;
    announceIncoming(call: CallInfo): void;
    /** The lifecycle of a call the app was never told about stays silent. */
    emitState(call: CallInfo): void;
    emitEnded(call: CallInfo): void;
    /** The delegate one session reports through; `endCall` ends a call through its owner. */
    sessionDelegate(endCall: (call: CallInfo, reason: EndCallReason) => void): WaCallMediaSessionDelegate;
}
