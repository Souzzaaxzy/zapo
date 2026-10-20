import type { Logger } from 'zapo-js';
import type { BinaryNode } from 'zapo-js/transport';
import type { WaVoipDeps } from '../types.js';
import type { CallInfo } from './call-state.js';
export type SendLogLevel = 'trace' | 'warn' | 'error';
/** Sends one call's stanzas, logging a failure under its call id. */
export declare class WaCallStanzaSender {
    private readonly deps;
    private readonly logger;
    private readonly info;
    constructor(deps: Pick<WaVoipDeps, 'lowLevelCoordinator'>, logger: Logger, info: Pick<CallInfo, 'callId'>);
    /** Sends a stanza, the failure left to the caller. */
    send(node: BinaryNode): Promise<void>;
    /** Sends a stanza built in the same guard, logging a failure; `false` when it failed. */
    sendLogged(build: () => BinaryNode, failure: string, level?: SendLogLevel, context?: Record<string, unknown>): Promise<boolean>;
    /** Sends a stanza nobody waits on; a failure is only logged. */
    sendDetached(node: BinaryNode, failure: string, level?: SendLogLevel, context?: Record<string, unknown>): void;
}
