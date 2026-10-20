"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePerJidSrtpKey = derivePerJidSrtpKey;
exports.generateCallKey = generateCallKey;
const crypto_1 = require("zapo-js/crypto");
const voip_media_1 = require("@zapo-js/voip-media");
const bytes_js_1 = require("../bytes.js");
/**
 * One device's end-to-end SRTP keying material: HKDF over the whole 32-byte call key, empty salt,
 * the device jid as info; 16 bytes of master key then 14 of master salt.
 */
function derivePerJidSrtpKey(callKey, deviceJid) {
    const output = (0, crypto_1.hkdf)(callKey, null, bytes_js_1.TEXT_ENCODER.encode(deviceJid), 46);
    return {
        masterKey: output.subarray(0, 16),
        masterSalt: output.subarray(16, 30)
    };
}
function generateCallKey() {
    return (0, voip_media_1.randomBytes)(32);
}
