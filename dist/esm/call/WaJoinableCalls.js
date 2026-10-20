import { setBoundedMapEntry, toError } from 'zapo-js/util';
import { parseRelayFromAck } from '../relay/relay-ack.js';
import { readGroupCallRoster, readGroupUpdateTransactionId } from '../signaling/group-info.js';
import { parseVoipSettings } from '../signaling/voip-settings.js';
import { CallMediaType } from '../types.js';
/** How many joinable calls this side is off are remembered at once. */
const MAX_JOINABLE_CALLS = 16;
/** Joinable group calls this side is off, by call id; see {@link WaJoinableCall}. */
export class WaJoinableCalls {
    constructor(logger) {
        this.logger = logger;
        this.calls = new Map();
    }
    get(callId) {
        return this.calls.get(callId);
    }
    remember(info, cause) {
        if (!info.isGroupCall || !info.joinable)
            return;
        setBoundedMapEntry(this.calls, info.callId, {
            callId: info.callId,
            callCreator: info.callCreator,
            groupJid: info.groupJid,
            cause,
            mediaType: info.mediaType,
            voipSettings: info.voipSettings,
            relayData: info.relayData,
            relayTransactionId: null,
            participants: info.groupComposition?.participants,
            rosterTransactionId: info.groupComposition?.lastTransactionId ?? null
        }, MAX_JOINABLE_CALLS);
    }
    /** Puts back a call taken for a join that failed. */
    restore(call) {
        setBoundedMapEntry(this.calls, call.callId, call, MAX_JOINABLE_CALLS);
    }
    forget(callId) {
        return this.calls.delete(callId);
    }
    /**
     * Folds a `group_update` into the joinable call it names: the newest relay, settings and
     * roster. `false` when no such call is remembered.
     */
    follow(node, inner, callId) {
        const call = this.calls.get(callId);
        if (!call)
            return false;
        const transactionId = readGroupUpdateTransactionId(inner);
        const relay = parseRelayFromAck(inner);
        const staleRelay = transactionId !== null &&
            call.relayTransactionId !== null &&
            transactionId < call.relayTransactionId;
        if (relay.endpoints.length > 0 && !staleRelay) {
            if (transactionId !== null)
                call.relayTransactionId = transactionId;
            call.relayData = relay;
        }
        const settings = parseVoipSettings(node, this.logger);
        if (settings)
            call.voipSettings = settings;
        try {
            const roster = readGroupCallRoster(inner);
            if (roster.kind === 'roster') {
                const stale = transactionId !== null &&
                    call.rosterTransactionId !== null &&
                    transactionId <= call.rosterTransactionId;
                if (!stale) {
                    call.participants = roster.participants;
                    call.rosterTransactionId = transactionId ?? call.rosterTransactionId;
                    if (roster.info.media === CallMediaType.Video) {
                        call.mediaType = CallMediaType.Video;
                    }
                }
            }
        }
        catch (err) {
            this.logger.debug('group update of a joinable call carried an unreadable roster', {
                callId,
                message: toError(err).message
            });
        }
        this.logger.debug('joinable call followed', {
            callId,
            cause: call.cause,
            rosterTransactionId: call.rosterTransactionId,
            relayCount: call.relayData?.endpoints.length ?? 0
        });
        return true;
    }
    clear() {
        this.calls.clear();
    }
}
