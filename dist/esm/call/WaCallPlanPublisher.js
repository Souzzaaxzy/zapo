import { toError } from 'zapo-js/util';
import { samePlanValue } from './media-plan.js';
/** Hands one call's plan changes to its media link, dropping sections equal to the last ones. */
export class WaCallPlanPublisher {
    constructor(media, logger, info) {
        /** Last value published per plan section, so an unchanged one is not sent again. */
        this.publishedSections = new Map();
        this.media = media;
        this.logger = logger;
        this.info = info;
    }
    /**
     * Hands a plan change to the media, leaving out sections equal to the last published ones;
     * `relays` always goes, since resending it asks a leg-less media side to dial. Failures log.
     */
    async publish(update) {
        let changed = null;
        for (const [section, value] of Object.entries(update)) {
            if (section !== 'relays' &&
                this.publishedSections.has(section) &&
                samePlanValue(this.publishedSections.get(section), value)) {
                continue;
            }
            this.publishedSections.set(section, value);
            (changed ?? (changed = {}))[section] = value;
        }
        if (!changed)
            return;
        try {
            await this.media.apply(changed);
        }
        catch (err) {
            this.logger.error('media plan update failed', {
                callId: this.info.callId,
                message: toError(err).message
            });
        }
    }
}
