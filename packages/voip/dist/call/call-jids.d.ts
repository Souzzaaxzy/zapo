import type { Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import type { WaVoipDeps } from '../types.js';
/** Our own jid as the credentials name it, lid first; empty before login. */
export declare function selfJidOf(deps: Pick<WaVoipDeps, 'authClient'>): string;
/** Whether `jid` is an account of ours, by lid or by pn. */
export declare function isOwnAccountJid(deps: Pick<WaVoipDeps, 'authClient'>, jid: string): boolean;
/** The form stanzas are addressed to and arrive from: device 0 bare. */
export declare function toAddressedJid(jid: string, logger: Logger): string;
/** Whether `jid` is a device of `userJid`'s account; an unreadable jid is not. */
export declare function isUserJidOf(jid: string, userJid: string, logger: Logger): boolean;
/**
 * The peer device that won a call we placed: the `<relay><participant>` of its `<accept>`
 * when it is a device of the called user, else the device the accept came from. `pid` is
 * the participant's, as on the wire. No pn/lid mapping: another domain falls back too.
 */
export declare function readAnsweringDevice(accept: BinaryNode, fromJid: string, call: {
    readonly callId: string;
    readonly peerJid: string;
}, logger: Logger): {
    jid: string;
    pid?: number;
};
