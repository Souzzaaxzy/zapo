import { hkdf } from 'zapo-js/crypto';
import { randomBytes } from '@zapo-js/voip-media';
import { TEXT_ENCODER } from '../bytes.js';
/**
 * One device's end-to-end SRTP keying material: HKDF over the whole 32-byte call key, empty salt,
 * the device jid as info; 16 bytes of master key then 14 of master salt.
 */
export function derivePerJidSrtpKey(callKey, deviceJid) {
    const output = hkdf(callKey, null, TEXT_ENCODER.encode(deviceJid), 46);
    return {
        masterKey: output.subarray(0, 16),
        masterSalt: output.subarray(16, 30)
    };
}
export function generateCallKey() {
    return randomBytes(32);
}
