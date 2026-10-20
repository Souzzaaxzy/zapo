"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_VIDEO_CALL_SSRC_SLOTS = exports.WA_AUDIO_CALL_SSRC_SLOTS = exports.WA_SSRC_SLOT = void 0;
exports.generateSecureSsrc = generateSecureSsrc;
const crypto_1 = require("zapo-js/crypto");
const bytes_js_1 = require("../bytes.js");
const VIDEO_SLOTS = { MAIN: 2, FEC: 3, OOB_NACK: 5 };
/**
 * Slot indices of the SSRC derivation; a screen share uses the camera's. Not the protobuf
 * stream layer ids, which differ on every value.
 */
exports.WA_SSRC_SLOT = {
    AUDIO: { MAIN: 0, FEC: 1, OOB_NACK: 4 },
    VIDEO: VIDEO_SLOTS,
    SCREEN_SHARE: VIDEO_SLOTS,
    /** One slot, not three: the client derives a single `app_data_ssrc`. */
    APP_DATA: { MAIN: 6 }
};
/**
 * Slots an audio-only call negotiates. App data is in the list because the audio profile
 * of `<voip_settings>` carries `enable_app_data_stream=1` too: leaving its SSRC out costs
 * the relay forwarding the peer's reactions.
 */
exports.WA_AUDIO_CALL_SSRC_SLOTS = [
    exports.WA_SSRC_SLOT.AUDIO.MAIN,
    exports.WA_SSRC_SLOT.AUDIO.FEC,
    exports.WA_SSRC_SLOT.AUDIO.OOB_NACK,
    exports.WA_SSRC_SLOT.APP_DATA.MAIN
];
/** Slots a video call negotiates: the audio stack plus the video streams. */
exports.WA_VIDEO_CALL_SSRC_SLOTS = [
    ...exports.WA_AUDIO_CALL_SSRC_SLOTS,
    exports.WA_SSRC_SLOT.VIDEO.MAIN,
    exports.WA_SSRC_SLOT.VIDEO.FEC,
    exports.WA_SSRC_SLOT.VIDEO.OOB_NACK
];
/**
 * The SSRC of one stream: HKDF-SHA256 with the call-id text as ikm, the slot as a u32 LE salt and
 * the device jid text as info (no slot suffix), 4 bytes out read as a u32 LE. The peer drops
 * media whose SSRC does not match this, while our receive path does not check it.
 */
function generateSecureSsrc(callId, deviceJid, slot = 0) {
    const salt = new Uint8Array(4);
    (0, bytes_js_1.writeUInt32LE)(salt, slot, 0);
    const result = (0, crypto_1.hkdf)(bytes_js_1.TEXT_ENCODER.encode(callId), salt, bytes_js_1.TEXT_ENCODER.encode(deviceJid), 4);
    return (0, bytes_js_1.readUInt32LE)(result, 0);
}
