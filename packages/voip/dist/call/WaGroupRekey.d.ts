import type { Logger } from 'zapo-js';
import type { GroupInfoParticipant } from '../signaling/group-info.js';
import type { WaVoipDeps } from '../types.js';
import type { CallInfo } from './call-state.js';
import type { WaCallStanzaSender } from './WaCallStanzaSender.js';
import type { WaGroupRoster } from './WaGroupRoster.js';
export interface WaGroupRekeyOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly deps: WaVoipDeps;
    readonly stanzas: WaCallStanzaSender;
    readonly roster: Pick<WaGroupRoster, 'accountKeyOf' | 'selfAccountKey'>;
    /** Installs the new call key and publishes it, before any `<enc_rekey>` leaves. */
    readonly installKey: (callKey: Uint8Array, transactionId: number) => Promise<void>;
}
/** The rekeys a group call's `<group_info>` asks of us: each run once, minted and fanned out. */
export declare class WaGroupRekey {
    private readonly info;
    private readonly logger;
    private readonly deps;
    private readonly stanzas;
    private readonly roster;
    private readonly installKey;
    /** The highest `transaction-id` whose rekey this side ran; ordered apart from rosters. */
    private lastHonouredRekeyTransactionId;
    constructor(options: WaGroupRekeyOptions);
    /** Whether the rekey announced under `transactionId` is ours to run; records it when it is. */
    accept(transactionId: number): boolean;
    /**
     * Runs the rekey a `<group_info rekey>` makes us master of: a new call key, installed and sent
     * in one `<enc_rekey>` per device of every other connected participant but `tos_not_accepted`.
     */
    run(transactionId: number, listed: readonly GroupInfoParticipant[]): Promise<void>;
}
