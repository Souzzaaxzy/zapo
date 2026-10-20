import type { Logger } from 'zapo-js';
import { type BinaryNode } from 'zapo-js/transport';
import { type WaCallMediaRelays } from '@zapo-js/voip-media';
import type { CallInfo } from './call-state.js';
import type { WaCallPlanPublisher } from './WaCallPlanPublisher.js';
import type { WaCallStanzaSender } from './WaCallStanzaSender.js';
export interface WaCallRelaysOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly stanzas: WaCallStanzaSender;
    readonly plan: WaCallPlanPublisher;
}
/** The relays one call dials: our relaylatency, the reissues it follows, the elected relay. */
export declare class WaCallRelays {
    private readonly info;
    private readonly logger;
    private readonly stanzas;
    private readonly plan;
    /** Relays our own `<relaylatency>` already named; bounded by the relays the server lists. */
    private readonly announcedRelayNames;
    /** Relays the media heard answer, with the round trip it measured; only these are named. */
    private readonly answeredRelays;
    /** Set once setup first asks for our `<relaylatency>`; a relay answering later is named then. */
    private relayLatencyOpened;
    /** The relays a `group_update` moved the call to, published in place of the offer's. */
    private adoptedRelays;
    private relayGeneration;
    /** The `transaction-id` of the newest `group_update` whose `<relay>` was read. */
    private relayTransactionId;
    constructor(options: WaCallRelaysOptions);
    /** Whether a reissue moved the call off the relays the offer listed. */
    get hasAdopted(): boolean;
    /**
     * One `<relaylatency>` per relay that answered us, each once per call: every device of the
     * peer preaccepts, and a name is claimed before its send yields. Stops once the call has
     * ended. The callee dials only on accept, so it names nothing while it rings.
     */
    sendLatency(): Promise<void>;
    /**
     * What `<te>` may say about our relays: only the ones we dial and that answered, once per
     * name, with our own latency and address. Naming another makes the peer elect a relay we
     * are not on.
     */
    private dialableRelayLatencies;
    /** A relay the server listed answered our media; named at once if setup already announced. */
    onAnswered(name: string, rttMs?: number): void;
    /** Logged only: the media elects its own relay. */
    recordElection(node: BinaryNode): void;
    /**
     * Follows a `<relay>` a `group_update` or `<transport>` reissues: a new generation of every
     * dialable relay, elected first, when addresses, credentials or pids changed. An identical
     * repeat or an older `group_update` publishes nothing; an omitted participant list is kept.
     */
    adoptReissued(inner: BinaryNode, transactionId: number | null): Promise<void>;
    /** The plan's `relays`: the ones a reissue moved the call to, else the ones it holds. */
    section(): WaCallMediaRelays | null;
}
