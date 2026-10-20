"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaCallPlanPublisher = void 0;
const util_1 = require("zapo-js/util");
const media_plan_js_1 = require("./media-plan.js");
/** Hands one call's plan changes to its media link, dropping sections equal to the last ones. */
class WaCallPlanPublisher {
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
                (0, media_plan_js_1.samePlanValue)(this.publishedSections.get(section), value)) {
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
                message: (0, util_1.toError)(err).message
            });
        }
    }
}
exports.WaCallPlanPublisher = WaCallPlanPublisher;
