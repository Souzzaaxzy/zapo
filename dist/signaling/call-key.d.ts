import { type Logger } from 'zapo-js';
import { proto } from 'zapo-js/proto';
import { type BinaryNode } from 'zapo-js/transport';
import type { WaVoipDeps } from '../types.js';
export declare function encodeWAMessage(message: Parameters<typeof proto.Message.encode>[0]): Promise<Uint8Array>;
export declare function decryptCallKey(deps: WaVoipDeps, node: BinaryNode, peerJid: string, logger?: Logger): Promise<Uint8Array | undefined>;
interface EncryptedCallKeyNodes {
    /** One `<enc>` per device, in the order the devices came in. */
    readonly encNodes: readonly BinaryNode[];
    readonly shouldIncludeDeviceIdentity: boolean;
}
/**
 * Encrypts a call key for each device under `<enc v='2' type count='0'>`: a 1:1 offer wraps
 * each in a `<to>`, an `<enc_rekey>` carries one directly.
 *
 * @throws for the whole batch when a device has no Signal session.
 */
export declare function encryptCallKeyForDevices(deps: WaVoipDeps, devices: readonly string[], callKey: Uint8Array): Promise<EncryptedCallKeyNodes>;
/** `<device-identity>` of our account, sent beside a `pkmsg` key. */
export declare function deviceIdentityNode(signedIdentity: Parameters<typeof proto.ADVSignedDeviceIdentity.encode>[0]): BinaryNode;
export {};
