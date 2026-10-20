/**
 * Slot indices of the SSRC derivation; a screen share uses the camera's. Not the protobuf
 * stream layer ids, which differ on every value.
 */
export declare const WA_SSRC_SLOT: {
    readonly AUDIO: {
        readonly MAIN: 0;
        readonly FEC: 1;
        readonly OOB_NACK: 4;
    };
    readonly VIDEO: {
        readonly MAIN: 2;
        readonly FEC: 3;
        readonly OOB_NACK: 5;
    };
    readonly SCREEN_SHARE: {
        readonly MAIN: 2;
        readonly FEC: 3;
        readonly OOB_NACK: 5;
    };
    /** One slot, not three: the client derives a single `app_data_ssrc`. */
    readonly APP_DATA: {
        readonly MAIN: 6;
    };
};
/**
 * Slots an audio-only call negotiates. App data is in the list because the audio profile
 * of `<voip_settings>` carries `enable_app_data_stream=1` too: leaving its SSRC out costs
 * the relay forwarding the peer's reactions.
 */
export declare const WA_AUDIO_CALL_SSRC_SLOTS: readonly [0, 1, 4, 6];
/** Slots a video call negotiates: the audio stack plus the video streams. */
export declare const WA_VIDEO_CALL_SSRC_SLOTS: readonly [0, 1, 4, 6, 2, 3, 5];
/**
 * The SSRC of one stream: HKDF-SHA256 with the call-id text as ikm, the slot as a u32 LE salt and
 * the device jid text as info (no slot suffix), 4 bytes out read as a u32 LE. The peer drops
 * media whose SSRC does not match this, while our receive path does not check it.
 */
export declare function generateSecureSsrc(callId: string, deviceJid: string, slot?: number): number;
