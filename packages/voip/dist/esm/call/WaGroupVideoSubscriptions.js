import { WA_VIDEO_QUALITY } from '@zapo-js/voip-media';
import { WA_VIDEO_STATE } from '../signaling/video-state.js';
import { toAddressedJid } from './call-jids.js';
import { selectVideoSubscriptions } from './group-media-plan.js';
import { WA_CALL_PARTICIPANT_STATE } from './group-participants.js';
import { samePlanValue } from './media-plan.js';
/** Least time between two changes of the video subscriptions. */
const VIDEO_SUBSCRIPTION_MIN_INTERVAL_MS = 2000;
/** Whose video a group call asks the SFU for, the policy's or the app's, changed at most every 2 s. */
export class WaGroupVideoSubscriptions {
    constructor(options) {
        /** Video subscriptions the app set, in place of the policy's; `null` for the policy. */
        this.videoSubscriptionOverride = null;
        this.videoSubscriptions = [];
        this.videoSubscriptionsChangedAt = null;
        this.videoSubscriptionTimer = null;
        this.info = options.info;
        this.logger = options.logger;
        this.now = options.now;
        this.onChange = options.onChange;
    }
    /** The subscriptions as last changed, which the group section carries. */
    get current() {
        return this.videoSubscriptions;
    }
    /** Takes the app's subscriptions in place of the policy's; `null` hands it back. */
    set(subscriptions) {
        this.videoSubscriptionOverride =
            subscriptions === null
                ? null
                : subscriptions.flatMap((subscription) => {
                    const senderId = this.info.participantMedia.get(toAddressedJid(subscription.participantJid, this.logger))?.senderId;
                    return senderId
                        ? [
                            {
                                senderId,
                                quality: subscription.quality ?? WA_VIDEO_QUALITY.Default
                            }
                        ]
                        : [];
                });
        this.refresh();
    }
    /** Recomputes the video subscriptions, at most once per {@link VIDEO_SUBSCRIPTION_MIN_INTERVAL_MS}. */
    refresh() {
        if (!this.info.isGroupCall || this.videoSubscriptionTimer)
            return;
        const next = this.videoSubscriptionOverride ?? this.policyVideoSubscriptions();
        if (samePlanValue(next, this.videoSubscriptions))
            return;
        const since = this.videoSubscriptionsChangedAt === null
            ? Infinity
            : this.now() - this.videoSubscriptionsChangedAt;
        if (since < VIDEO_SUBSCRIPTION_MIN_INTERVAL_MS) {
            this.videoSubscriptionTimer = setTimeout(() => {
                this.videoSubscriptionTimer = null;
                this.refresh();
            }, VIDEO_SUBSCRIPTION_MIN_INTERVAL_MS - since);
            this.videoSubscriptionTimer.unref?.();
            return;
        }
        this.videoSubscriptions = next;
        this.videoSubscriptionsChangedAt = this.now();
        this.logger.debug('video subscriptions changed', {
            callId: this.info.callId,
            subscriptions: next.length
        });
        this.onChange();
    }
    /** Drops a pending change; the call is over. */
    stop() {
        if (this.videoSubscriptionTimer)
            clearTimeout(this.videoSubscriptionTimer);
        this.videoSubscriptionTimer = null;
    }
    policyVideoSubscriptions() {
        const connected = (this.info.groupComposition?.participants ?? []).filter((participant) => participant.state === WA_CALL_PARTICIPANT_STATE.Connected).length;
        const senders = [];
        for (const [senderId, deviceJid] of this.info.groupSenders) {
            const state = this.info.participantMedia.get(deviceJid)?.video?.state;
            senders.push({ senderId, videoEnabled: state === WA_VIDEO_STATE.Enabled });
        }
        return selectVideoSubscriptions(senders, connected);
    }
}
