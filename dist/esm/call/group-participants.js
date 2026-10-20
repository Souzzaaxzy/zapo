import { groupParticipantAccountKey } from '../jid.js';
/**
 * `state` of a `<user>` or `<participant>` as the wire spells it: text from a table of its own,
 * not the enum names lowercased (ordinal 2 is `outgoing`, ordinal 10 `cancel_offer`).
 */
export const WA_CALL_PARTICIPANT_STATE = Object.freeze({
    Invalid: 'invalid',
    Connected: 'connected',
    Outgoing: 'outgoing',
    Receipt: 'receipt',
    Rejected: 'rejected',
    Terminated: 'terminated',
    TimedOut: 'timedout',
    Creating: 'creating',
    Invisible: 'invisible',
    Visible: 'visible',
    CancelOffer: 'cancel_offer',
    Invited: 'invited'
});
const PRESENT_STATES = new Set([
    WA_CALL_PARTICIPANT_STATE.Connected,
    WA_CALL_PARTICIPANT_STATE.Outgoing,
    WA_CALL_PARTICIPANT_STATE.Receipt,
    WA_CALL_PARTICIPANT_STATE.Creating,
    WA_CALL_PARTICIPANT_STATE.Invisible,
    WA_CALL_PARTICIPANT_STATE.Visible,
    WA_CALL_PARTICIPANT_STATE.Invited
]);
const CLEAN_DEPARTURE_STATES = new Set([
    WA_CALL_PARTICIPANT_STATE.Terminated,
    WA_CALL_PARTICIPANT_STATE.Invalid
]);
/** Departures from before the participant ever connected. */
const UNEXPECTED_DEPARTURE_STATES = new Set([
    WA_CALL_PARTICIPANT_STATE.Rejected,
    WA_CALL_PARTICIPANT_STATE.TimedOut,
    WA_CALL_PARTICIPANT_STATE.CancelOffer
]);
/** Why a change asks for new keys. The key is per participant: a device leaving keeps it. */
export const WA_GROUP_REKEY_REASON = Object.freeze({
    ParticipantAdded: 'participant_added',
    ParticipantRemoved: 'participant_removed',
    /** The `rekey` flag of the update: the server asked, whatever the diff shows. */
    UpdateFlag: 'update_flag'
});
/** What took a participant off the call. */
export const WA_GROUP_REMOVAL_CAUSE = Object.freeze({
    /** Left out of a roster, which is always the whole call. */
    Absent: 'absent',
    /** Listed as `terminated` or `invalid`. */
    Departed: 'departed',
    /** Listed as `rejected`, `timedout` or `cancel_offer`. */
    DepartedUnexpected: 'departed_unexpected',
    /** Carrying the in-band nack, whatever its state said. */
    Nacked: 'nacked'
});
function departureCauseOfState(state) {
    if (CLEAN_DEPARTURE_STATES.has(state))
        return WA_GROUP_REMOVAL_CAUSE.Departed;
    if (UNEXPECTED_DEPARTURE_STATES.has(state))
        return WA_GROUP_REMOVAL_CAUSE.DepartedUnexpected;
    return null;
}
function isRecognizedState(state) {
    return PRESENT_STATES.has(state) || departureCauseOfState(state) !== null;
}
/** Whether a `state` names a participant on the call or arriving; false is not a departure. */
export function isGroupParticipantPresent(state) {
    return PRESENT_STATES.has(state);
}
/** Whether an update reports this participant off the call, by nack or by state. */
export function isGroupParticipantLeaving(participant) {
    return removalCauseOf(participant) !== null;
}
function removalCauseOf(participant) {
    if (participant.nacked === true)
        return WA_GROUP_REMOVAL_CAUSE.Nacked;
    if (participant.state === undefined)
        return null;
    return departureCauseOfState(participant.state);
}
export function createGroupComposition(participants, transactionId = null) {
    return { participants, lastTransactionId: transactionId };
}
/**
 * Diffs a whole roster against the composition in hand. A state outside
 * {@link WA_CALL_PARTICIPANT_STATE} keeps its participant and is logged: tearing down someone
 * present cannot be undone, keeping someone a moment too long can.
 */
export function diffGroupParticipants(current, incoming, logger) {
    const added = [];
    const switched = [];
    const removed = [];
    const devicesAdded = [];
    const devicesRemoved = [];
    const before = new Map();
    for (const participant of current) {
        before.set(groupParticipantAccountKey(participant.jid), participant);
    }
    const listed = new Set();
    for (const participant of incoming) {
        const key = groupParticipantAccountKey(participant.jid);
        listed.add(key);
        const previous = before.get(key);
        if (participant.state !== undefined && !isRecognizedState(participant.state)) {
            logger.warn('group call participant state not recognized, keeping the participant', {
                jid: participant.jid,
                state: participant.state
            });
        }
        const cause = removalCauseOf(participant);
        if (cause !== null) {
            if (previous)
                removed.push({ jid: previous.jid, participant: previous, cause });
            continue;
        }
        if (!previous) {
            added.push(participant);
            continue;
        }
        const previousDeviceJid = previous.devices[0];
        const deviceJid = participant.devices[0];
        if (previous.devices.length === 1 &&
            participant.devices.length === 1 &&
            previousDeviceJid !== undefined &&
            deviceJid !== undefined &&
            previousDeviceJid !== deviceJid) {
            switched.push({ jid: participant.jid, participant, previousDeviceJid, deviceJid });
            continue;
        }
        for (const device of participant.devices) {
            if (!previous.devices.includes(device)) {
                devicesAdded.push({ jid: participant.jid, participant, deviceJid: device });
            }
        }
        for (const device of previous.devices) {
            if (!participant.devices.includes(device)) {
                devicesRemoved.push({ jid: participant.jid, participant, deviceJid: device });
            }
        }
    }
    for (const participant of current) {
        if (!listed.has(groupParticipantAccountKey(participant.jid))) {
            removed.push({
                jid: participant.jid,
                participant,
                cause: WA_GROUP_REMOVAL_CAUSE.Absent
            });
        }
    }
    const rekeyReason = removed.length > 0
        ? WA_GROUP_REKEY_REASON.ParticipantRemoved
        : added.length > 0
            ? WA_GROUP_REKEY_REASON.ParticipantAdded
            : null;
    return {
        added,
        switched,
        removed,
        devicesAdded,
        devicesRemoved,
        rekeyRequired: rekeyReason !== null,
        rekeyReason
    };
}
/** Whether an update repeats or predates the `transaction-id` already applied. */
export function isStaleGroupUpdate(composition, update) {
    const last = composition.lastTransactionId;
    return last !== null && update.transactionId <= last;
}
/**
 * Folds one update into a composition. A roster replaces the composition minus whoever it
 * reports leaving; an update without one moves neither the participants nor the counter.
 */
export function applyGroupUpdate(composition, update, logger) {
    const roster = update.participants;
    if (roster === undefined) {
        return { applied: false, discardReason: 'no_roster', transactionId: update.transactionId };
    }
    if (isStaleGroupUpdate(composition, update)) {
        return {
            applied: false,
            discardReason: 'stale',
            transactionId: update.transactionId,
            lastTransactionId: composition.lastTransactionId ?? update.transactionId
        };
    }
    const diff = diffGroupParticipants(composition.participants, roster, logger);
    return {
        applied: true,
        composition: {
            participants: roster.filter((participant) => removalCauseOf(participant) === null),
            lastTransactionId: update.transactionId
        },
        diff: update.rekey === true && !diff.rekeyRequired
            ? { ...diff, rekeyRequired: true, rekeyReason: WA_GROUP_REKEY_REASON.UpdateFlag }
            : diff
    };
}
