import type { WaAuthCredentials } from '../../auth/types';
import type { Logger } from '../../infra/log/types';
import type { BinaryNode } from '../../transport/types';
export type WaMediaRetryResultType = 'success' | 'not_found' | 'decryption_error' | 'general_error';
/**
 * Answer to a media reupload request.
 *
 * On `result: 'success'` the fresh `directPath` usually points at the same
 * ciphertext the original message described, so its media key, hashes and
 * length stay valid. Some primaries re-encrypt the file on every re-upload
 * instead: the answer is still `success`, but the re-served blob no longer
 * matches `fileEncSha256` and decryption fails with a MAC mismatch. Nothing in
 * the round-trip carries key material for the new ciphertext, so treat that
 * message as unrecoverable rather than retrying.
 */
export interface WaMediaRetryResult {
    readonly messageId: string;
    readonly result: WaMediaRetryResultType;
    readonly resultCode: number;
    readonly directPath?: string;
}
export interface WaMediaRetryRequest {
    readonly messageId: string;
    readonly chatJid: string;
    readonly mediaKey: Uint8Array;
    readonly fromMe: boolean;
    readonly participant?: string;
    readonly timeoutMs?: number;
}
export interface WaMediaRetryRequesterOptions {
    readonly logger: Logger;
    readonly sendNode: (node: BinaryNode) => Promise<void>;
    readonly getCurrentCredentials: () => WaAuthCredentials | null;
    readonly defaultTimeoutMs?: number;
    readonly maxPending?: number;
}
export interface WaMediaRetryRequester {
    readonly request: (input: WaMediaRetryRequest) => Promise<WaMediaRetryResult>;
    readonly handleNotification: (node: BinaryNode) => void;
}
type ParsedMediaRetryNotification = {
    readonly messageId: string;
    readonly from?: string;
} & ({
    readonly errorCode: number;
    readonly ciphertext?: undefined;
} | {
    readonly errorCode?: undefined;
    readonly ciphertext: Uint8Array;
    readonly iv: Uint8Array;
});
export declare function parseMediaRetryNotification(node: BinaryNode): ParsedMediaRetryNotification | null;
export declare function createMediaRetryRequester(options: WaMediaRetryRequesterOptions): WaMediaRetryRequester;
export {};
