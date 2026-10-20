import type { Logger } from 'zapo-js';
import type { CallOfferParticipant, WaVoipDeps } from './types.js';
type DeviceSyncDeps = Pick<WaVoipDeps, 'signalDeviceSync'>;
/** The LID a phone jid maps to, or the jid as given when it is one already or none is known. */
export declare function resolvePeerLid(deps: DeviceSyncDeps, peerJid: string, logger: Logger): Promise<string>;
/** The devices of a calling peer, primary first; a jid naming a companion is kept alone. */
export declare function resolvePeerDeviceJids(deps: DeviceSyncDeps, peerJid: string, logger: Logger): Promise<string[]>;
/**
 * Resolves the devices of the participants given none, like a 1:1 callee's. One left
 * unresolved keeps an empty list and is rung on its primary device.
 */
export declare function resolveOfferParticipantDevices(deps: DeviceSyncDeps, participants: readonly CallOfferParticipant[], log: Logger): Promise<readonly {
    readonly jid: string;
    readonly devices: readonly string[];
}[]>;
export {};
