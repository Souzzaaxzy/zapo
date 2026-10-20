import type { Logger } from 'zapo-js';
import type { WaCallMediaPlanUpdate } from '@zapo-js/voip-media';
import type { CallInfo } from './call-state.js';
import type { WaCallMediaLink } from './media-link.js';
/** Hands one call's plan changes to its media link, dropping sections equal to the last ones. */
export declare class WaCallPlanPublisher {
    private readonly media;
    private readonly logger;
    private readonly info;
    /** Last value published per plan section, so an unchanged one is not sent again. */
    private readonly publishedSections;
    constructor(media: Pick<WaCallMediaLink, 'apply'>, logger: Logger, info: Pick<CallInfo, 'callId'>);
    /**
     * Hands a plan change to the media, leaving out sections equal to the last published ones;
     * `relays` always goes, since resending it asks a leg-less media side to dial. Failures log.
     */
    publish(update: WaCallMediaPlanUpdate): Promise<void>;
}
