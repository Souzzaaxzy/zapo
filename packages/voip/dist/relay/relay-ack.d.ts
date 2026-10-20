import { type BinaryNode } from 'zapo-js/transport';
import type { RelayData } from '../types.js';
/**
 * Parses the `<relay>` descriptor out of a call ack, or out of its inner
 * `<call>` node.
 *
 * A dual-stack endpoint is one relay reachable over both families, so it
 * expands into two entries, IPv4 first, that share every non-address field.
 * The attributes of the `<relay>` node are copied onto every endpoint.
 */
export declare function parseRelayFromAck(ackNode: BinaryNode): RelayData & {
    participantJids: string[];
    uuid: string;
};
