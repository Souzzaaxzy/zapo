import { type SrtpKeyingMaterial } from '@zapo-js/voip-media';
/**
 * One device's end-to-end SRTP keying material: HKDF over the whole 32-byte call key, empty salt,
 * the device jid as info; 16 bytes of master key then 14 of master salt.
 */
export declare function derivePerJidSrtpKey(callKey: Uint8Array, deviceJid: string): SrtpKeyingMaterial;
export declare function generateCallKey(): Uint8Array;
