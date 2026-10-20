import { type BinaryNode } from 'zapo-js/transport';
import type { RelayEndpoint } from '../types.js';
export declare function extractRelayEndpoints(node: BinaryNode): RelayEndpoint[];
export declare function buildRelayLatencyStanza(peerJid: string, callId: string, callCreator: string, relays: Array<{
    relayName: string;
    latency: number;
    addressBytes?: Uint8Array;
}>, destinationJids: string[]): BinaryNode;
export declare function buildTransportStanza(peerJid: string, callId: string, callCreator: string, messageType?: string, p2pCandRound?: string): BinaryNode;
