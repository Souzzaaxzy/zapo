"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaGroupRoster = void 0;
const protocol_1 = require("zapo-js/protocol");
const util_1 = require("zapo-js/util");
const jid_js_1 = require("../jid.js");
const group_info_js_1 = require("../signaling/group-info.js");
const call_jids_js_1 = require("./call-jids.js");
const group_media_plan_js_1 = require("./group-media-plan.js");
const group_participants_js_1 = require("./group-participants.js");
/** Who is on a group call as this side reads it: seeds, departures and account matching. */
class WaGroupRoster {
    constructor(options) {
        /** Account keys of roster entries, which are replaced whole and never mutated. */
        this.accountKeys = new WeakMap();
        this.selfKeyOf = null;
        this.info = options.info;
        this.logger = options.logger;
        this.selfJid = options.selfJid;
    }
    /**
     * Seeds the composition from the `<group_info>` of an offer, leaving out whoever it already
     * reports off the call. An unreadable or empty one seeds nothing and gives `null`.
     */
    seedFromOffer(inner) {
        let roster;
        try {
            roster = (0, group_info_js_1.readGroupCallRoster)(inner);
        }
        catch (err) {
            this.logger.warn('offer carried an unreadable group_info', {
                callId: this.info.callId,
                message: (0, util_1.toError)(err).message
            });
            return null;
        }
        if (roster.kind !== 'roster') {
            if (roster.kind === 'empty') {
                this.logger.warn('offer carried a group_info listing nobody, no composition set', {
                    callId: this.info.callId
                });
            }
            return null;
        }
        const present = roster.participants.filter((participant) => !(0, group_participants_js_1.isGroupParticipantLeaving)(participant));
        this.info.groupComposition = (0, group_participants_js_1.createGroupComposition)(present);
        return { participantCount: present.length, connectedLimit: roster.info.connectedLimit };
    }
    /** Seeds the composition of a call joined after its ring from the last roster kept. */
    seedJoin(participants, transactionId) {
        this.info.groupComposition = (0, group_participants_js_1.createGroupComposition)(participants.filter((participant) => !(0, group_participants_js_1.isGroupParticipantLeaving)(participant)), transactionId);
    }
    /** Seeds the composition of a call we place, from the participants our offer named. */
    seedOutgoing(participants) {
        this.info.groupComposition = (0, group_participants_js_1.createGroupComposition)(participants);
    }
    /**
     * Takes `peerJid`'s account off the composition, its counter kept, and returns the change;
     * `null` when it was not on it.
     */
    remove(peerJid, reason) {
        const composition = this.info.groupComposition;
        const key = peerJid ? (0, jid_js_1.groupParticipantAccountKey)(peerJid) : null;
        const departing = key === null
            ? undefined
            : composition?.participants.find((participant) => this.accountKeyOf(participant) === key);
        if (!composition || !departing) {
            this.logger.debug('group participant left, not on the composition', {
                callId: this.info.callId,
                peerJid: peerJid ?? null,
                reason: reason ?? null
            });
            return null;
        }
        const remaining = composition.participants.filter((participant) => participant !== departing);
        const diff = (0, group_participants_js_1.diffGroupParticipants)(composition.participants, [...remaining, { ...departing, state: group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Terminated }], this.logger);
        this.info.groupComposition = {
            participants: remaining,
            lastTransactionId: composition.lastTransactionId
        };
        return diff;
    }
    logDiff(message, diff, context = {}) {
        this.logger.debug(message, {
            callId: this.info.callId,
            ...context,
            added: diff.added.length,
            removed: diff.removed.length,
            switched: diff.switched.length,
            devicesAdded: diff.devicesAdded.length,
            devicesRemoved: diff.devicesRemoved.length,
            rekeyRequired: diff.rekeyRequired,
            rekeyReason: diff.rekeyReason,
            participantCount: this.info.groupComposition?.participants.length ?? 0
        });
    }
    selfAccountKey() {
        const selfJid = this.selfJid();
        if (!selfJid)
            return null;
        if (this.selfKeyOf?.jid !== selfJid) {
            this.selfKeyOf = { jid: selfJid, key: (0, jid_js_1.groupParticipantAccountKey)(selfJid) };
        }
        return this.selfKeyOf.key;
    }
    accountKeyOf(participant) {
        let key = this.accountKeys.get(participant);
        if (key === undefined) {
            key = (0, jid_js_1.groupParticipantAccountKey)(participant.jid);
            this.accountKeys.set(participant, key);
        }
        return key;
    }
    /** Every device sending into this group call, ourselves left out. */
    senderDevices() {
        const composition = this.info.groupComposition;
        if (!composition)
            return [];
        return (0, group_media_plan_js_1.groupSenderDeviceJids)(composition, this.selfJid(), (participant) => this.accountKeyOf(participant));
    }
    /** The device a jid names on this call, device 0 bare; an account names its first device. */
    participantDeviceOf(jid) {
        const key = (0, jid_js_1.groupParticipantAccountKey)(jid);
        const participant = this.info.groupComposition?.participants.find((entry) => this.accountKeyOf(entry) === key);
        if (!participant)
            return null;
        if ((0, protocol_1.toUserJid)(jid) === jid) {
            const first = participant.devices[0];
            return first ? (0, call_jids_js_1.toAddressedJid)(first, this.logger) : null;
        }
        const wanted = (0, call_jids_js_1.toAddressedJid)(jid, this.logger);
        const device = participant.devices.find((deviceJid) => (0, call_jids_js_1.toAddressedJid)(deviceJid, this.logger) === wanted);
        return device ? (0, call_jids_js_1.toAddressedJid)(device, this.logger) : null;
    }
    /** Whether the roster lists somebody but us connected. */
    hasOtherConnected() {
        const selfKey = this.selfAccountKey();
        return (this.info.groupComposition?.participants ?? []).some((participant) => participant.state === group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Connected &&
            this.accountKeyOf(participant) !== selfKey);
    }
    /** Whether a roster change brought somebody else in, or connected somebody already listed. */
    anyoneArrived(before, after) {
        const selfKey = this.selfAccountKey();
        const connectedBefore = new Set();
        const listedBefore = new Set();
        for (const participant of before.participants) {
            const key = this.accountKeyOf(participant);
            listedBefore.add(key);
            if (participant.state === group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Connected)
                connectedBefore.add(key);
        }
        return after.participants.some((participant) => {
            const key = this.accountKeyOf(participant);
            if (key === selfKey)
                return false;
            if (!listedBefore.has(key))
                return true;
            return (participant.state === group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Connected &&
                !connectedBefore.has(key));
        });
    }
}
exports.WaGroupRoster = WaGroupRoster;
