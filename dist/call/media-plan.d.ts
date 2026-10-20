import type { WaCallMediaSettings } from '@zapo-js/voip-media';
import type { WaVoipSettings } from '../signaling/voip-settings.js';
/** Slots a video call registers with the relay and an audio call does not: what an upgrade adds. */
export declare const VIDEO_ONLY_SSRC_SLOTS: readonly number[];
/** The plan's `settings` section: what the media tunes from the call's `<voip_settings>`. */
export declare function toMediaSettings(settings: WaVoipSettings): WaCallMediaSettings;
/** Deep equality for plan values: bytes by content, arrays and objects field by field. */
export declare function samePlanValue(left: unknown, right: unknown): boolean;
