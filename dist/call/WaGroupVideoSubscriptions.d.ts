import type { Logger } from 'zapo-js';
import { type WaCallMediaVideoSubscription } from '@zapo-js/voip-media';
import type { CallVideoSubscription } from '../types.js';
import type { CallInfo } from './call-state.js';
export interface WaGroupVideoSubscriptionsOptions {
    readonly info: CallInfo;
    readonly logger: Logger;
    readonly now: () => number;
    /** The subscriptions changed: the group plan is to be published again. */
    readonly onChange: () => void;
}
/** Whose video a group call asks the SFU for, the policy's or the app's, changed at most every 2 s. */
export declare class WaGroupVideoSubscriptions {
    private readonly info;
    private readonly logger;
    private readonly now;
    private readonly onChange;
    /** Video subscriptions the app set, in place of the policy's; `null` for the policy. */
    private videoSubscriptionOverride;
    private videoSubscriptions;
    private videoSubscriptionsChangedAt;
    private videoSubscriptionTimer;
    constructor(options: WaGroupVideoSubscriptionsOptions);
    /** The subscriptions as last changed, which the group section carries. */
    get current(): readonly WaCallMediaVideoSubscription[];
    /** Takes the app's subscriptions in place of the policy's; `null` hands it back. */
    set(subscriptions: readonly CallVideoSubscription[] | null): void;
    /** Recomputes the video subscriptions, at most once per {@link VIDEO_SUBSCRIPTION_MIN_INTERVAL_MS}. */
    refresh(): void;
    /** Drops a pending change; the call is over. */
    stop(): void;
    private policyVideoSubscriptions;
}
