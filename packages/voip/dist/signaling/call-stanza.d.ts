import { type BinaryNode } from 'zapo-js/transport';
import type { NodeInfo } from '../types.js';
/** 16 random bytes as 32 uppercase hex characters. */
export declare function generateCallStanzaId(): string;
/** A new call id, in the stanza id format. */
export declare function generateCallId(): string;
/** A `<call>` to `to` whose one child names the call: `call-id`, `call-creator`, then `attrs` in order. */
export declare function callStanza(to: string, tag: string, callId: string, callCreator: string, attrs?: Readonly<Record<string, string>>, content?: BinaryNode[]): BinaryNode;
/** Where a call answer goes: `<call-id>@call` on a group call, the peer device verbatim on 1:1. */
export declare function callTarget(peerJid: string, callId: string, isGroupCall: boolean): string;
export declare function extractNodeInfo(node: BinaryNode): NodeInfo | null;
/** The address of a call itself: where a group offer and a group accept go. */
export declare function toCallServerJid(callId: string): string;
/** The call id a `<call-id>@call` address names, or `null` for any other jid. */
export declare function callIdOfCallServerJid(jid: string | undefined): string | null;
