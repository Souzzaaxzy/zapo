"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDeviceJid = toDeviceJid;
exports.isSameDeviceJid = isSameDeviceJid;
exports.groupParticipantAccountKey = groupParticipantAccountKey;
exports.addressDeviceJid = addressDeviceJid;
exports.relayListedDeviceJid = relayListedDeviceJid;
const protocol_1 = require("zapo-js/protocol");
/**
 * A device jid with its `:device`, bare meaning the primary: the form SSRCs and SRTP keys derive
 * from. The server is kept as received.
 */
function toDeviceJid(jid) {
    return /:\d+@/.test(jid) ? jid : jid.replace('@', ':0@');
}
/** Device 0 travels both bare and as `:0`, so device jids compare in one form. */
function isSameDeviceJid(left, right) {
    return toDeviceJid(left) === toDeviceJid(right);
}
/**
 * The key an account is matched by: user and canonical domain, device dropped. One account
 * travels bare, as `:0` and as `:76` within a single call.
 */
function groupParticipantAccountKey(jid) {
    const address = (0, protocol_1.parseSignalAddressFromJid)(jid);
    return `${address.user}@${(0, protocol_1.canonicalizeSignalServer)(address.server ?? protocol_1.WA_DEFAULTS.HOST_DOMAIN)}`;
}
/** A device jid parsed into its addressed form: a bare jid names the primary and gets its `:0`. */
function addressDeviceJid(jid) {
    const address = (0, protocol_1.parseSignalAddressFromJid)(jid);
    const server = address.server ?? protocol_1.WA_DEFAULTS.HOST_DOMAIN;
    return { jid: `${address.user}:${address.device}@${server}`, deviceId: address.device, server };
}
/** Our device as the relay lists it among the participants, else our account jid. */
function relayListedDeviceJid(ourJid, participantJids) {
    const ourBase = ourJid ? (0, protocol_1.toUserJid)(ourJid) : '';
    return participantJids.find((jid) => (0, protocol_1.toUserJid)(jid) === ourBase && /:\d+@/.test(jid)) || ourJid;
}
