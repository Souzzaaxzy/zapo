import { type Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import type { WaVoipDeps, WaVoipStores } from '../types.js';
/** `joinable` of an `<offer>`: whether others may still join. Says nothing about group-ness. */
export declare function parseJoinableAttr(innerNode: BinaryNode): boolean;
/** `group-jid` of an `<offer>`, in either spelling, or `null` on a call that is no group's. */
export declare function parseGroupJidAttr(innerNode: BinaryNode): string | null;
/** `re-ring='1'` of an `<offer>`: a call already going rings this side again, with no `<relay>`. */
export declare function parseReRingAttr(innerNode: BinaryNode): boolean;
/**
 * Version, mask length, then a 40-bit mask read LSB-first. Neither blob sets bit 36
 * (`enable_mlow_red`, `0x10` of the last byte) nor 38 (`enable_mlow_separate_pt_tx`, `0x40`): a peer
 * that sees them may send RED this side cannot fully unwrap, in-band or on its own payload type.
 */
export declare const CAPABILITY_OFFER: Uint8Array<ArrayBuffer>;
export declare const CAPABILITY_VIDEO_OFFER: Uint8Array<ArrayBuffer>;
/**
 * The media an offer announces, 1:1 or group: the two opus rates, video when asked, `<net>`.
 *
 * `isLightweight` marks a group call as a voice chat, which announces `<silence>` instead of
 * media: it never rings and nobody speaks until a member joins. Measured against WhatsApp Web,
 * a voice chat offer differs from a plain one by the `lightweight` attribute plus this node.
 */
export declare function buildOfferMediaNodes(isVideo: boolean, isLightweight?: boolean): BinaryNode[];
export declare function buildOfferStanza(deps: WaVoipDeps, stores: WaVoipStores, callId: string, callKey: Uint8Array, peerJid: string, isVideo: boolean, logger?: Logger): Promise<BinaryNode>;
/**
 * Builds the `<call><accept>`: no `<enc>` or `<device-identity>` (the server drops an accept
 * carrying `<enc>`), `<encopt>` only on a group accept, which goes to `<call-id>@call`; a 1:1
 * accept goes to the caller device verbatim. Video answers `enc='h.264' dec='H264'`.
 */
export declare function buildAcceptStanza(deps: WaVoipDeps, callId: string, peerJid: string, callCreator: string, isVideo: boolean, isGroupCall?: boolean): Promise<BinaryNode>;
export declare function buildTerminateStanza(peerJid: string, callId: string, callCreator: string, audioDurationMs?: number, reason?: string): BinaryNode;
/**
 * The reject goes to the device that sent the offer (a bare user never reaches a companion), or
 * to `<call-id>@call` with `count='0'` on a group call, so the others stop listing us as ringing.
 */
export declare function buildRejectStanza(peerJid: string, callId: string, callCreator: string, isGroupCall?: boolean): BinaryNode;
/** A group preaccept (`isGroupCall`) carries the same children, addressed to `<call-id>@call`. */
export declare function buildPreacceptStanza(peerJid: string, callId: string, callCreator: string, isGroupCall?: boolean): BinaryNode;
export declare function buildAcceptReceiptStanza(peerDeviceJid: string, acceptMsgId: string, callId: string, callCreator: string, ourJid: string): BinaryNode;
export declare function needsDecryption(tag: string): boolean;
