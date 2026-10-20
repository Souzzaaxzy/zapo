"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfJidOf = selfJidOf;
exports.isOwnAccountJid = isOwnAccountJid;
exports.toAddressedJid = toAddressedJid;
exports.isUserJidOf = isUserJidOf;
exports.readAnsweringDevice = readAnsweringDevice;
const protocol_1 = require("zapo-js/protocol");
const transport_1 = require("zapo-js/transport");
const util_1 = require("zapo-js/util");
/** Our own jid as the credentials name it, lid first; empty before login. */
function selfJidOf(deps) {
    const creds = deps.authClient.getCurrentCredentials();
    return creds?.meLid || creds?.meJid || '';
}
/** Whether `jid` is an account of ours, by lid or by pn. */
function isOwnAccountJid(deps, jid) {
    const creds = deps.authClient.getCurrentCredentials();
    const user = (0, protocol_1.toUserJid)(jid);
    return ((!!creds?.meLid && user === (0, protocol_1.toUserJid)(creds.meLid)) ||
        (!!creds?.meJid && user === (0, protocol_1.toUserJid)(creds.meJid)));
}
/** The form stanzas are addressed to and arrive from: device 0 bare. */
function toAddressedJid(jid, logger) {
    try {
        return (0, protocol_1.normalizeDeviceJid)(jid);
    }
    catch (err) {
        logger.trace('device jid kept as received', {
            jid,
            message: (0, util_1.toError)(err).message
        });
        return jid;
    }
}
/** Whether `jid` is a device of `userJid`'s account; an unreadable jid is not. */
function isUserJidOf(jid, userJid, logger) {
    try {
        return (0, protocol_1.toUserJid)(jid) === (0, protocol_1.toUserJid)(userJid);
    }
    catch (err) {
        logger.trace('unreadable jid, not the called user', {
            jid,
            message: (0, util_1.toError)(err).message
        });
        return false;
    }
}
/**
 * The peer device that won a call we placed: the `<relay><participant>` of its `<accept>`
 * when it is a device of the called user, else the device the accept came from. `pid` is
 * the participant's, as on the wire. No pn/lid mapping: another domain falls back too.
 */
function readAnsweringDevice(accept, fromJid, call, logger) {
    for (const relay of (0, transport_1.getNodeChildrenByTag)(accept, 'relay')) {
        for (const participant of (0, transport_1.getNodeChildrenByTag)(relay, 'participant')) {
            const jid = participant.attrs?.jid;
            if (!jid)
                continue;
            if (!isUserJidOf(jid, call.peerJid, logger)) {
                logger.debug('accept participant not of the called user, ignored', {
                    callId: call.callId,
                    participant: jid,
                    from: fromJid
                });
                continue;
            }
            const pid = Number(participant.attrs.pid);
            return {
                jid: toAddressedJid(jid, logger),
                pid: participant.attrs.pid && Number.isSafeInteger(pid) ? pid : undefined
            };
        }
    }
    return { jid: fromJid };
}
