"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePeerLid = resolvePeerLid;
exports.resolvePeerDeviceJids = resolvePeerDeviceJids;
exports.resolveOfferParticipantDevices = resolveOfferParticipantDevices;
const protocol_1 = require("zapo-js/protocol");
const util_1 = require("zapo-js/util");
const jid_js_1 = require("./jid.js");
/** The LID a phone jid maps to, or the jid as given when it is one already or none is known. */
async function resolvePeerLid(deps, peerJid, logger) {
    if ((0, protocol_1.isLidJid)(peerJid))
        return peerJid;
    try {
        const [mapped] = await deps.signalDeviceSync.queryLidsByPhoneJids([peerJid]);
        if (mapped?.lidJid)
            return mapped.lidJid;
    }
    catch (err) {
        logger.trace('lid resolution failed', { message: (0, util_1.toError)(err).message });
    }
    return peerJid;
}
/** The devices of a calling peer, primary first; a jid naming a companion is kept alone. */
async function resolvePeerDeviceJids(deps, peerJid, logger) {
    const primaryJid = (0, jid_js_1.toDeviceJid)(peerJid);
    if (/:[1-9]\d*@/.test(peerJid))
        return [peerJid];
    try {
        const synced = await deps.signalDeviceSync.syncDeviceList([peerJid]);
        const devices = synced.flatMap((entry) => entry.deviceJids);
        const resolved = Array.from(new Set([primaryJid, ...devices]));
        if (resolved.length > 0) {
            logger.debug('incoming peer device resolved', {
                peerJid,
                peerDeviceJids: resolved,
                deviceCount: resolved.length
            });
            return resolved;
        }
    }
    catch (err) {
        logger.trace('incoming peer device resolution failed', {
            peerJid,
            message: (0, util_1.toError)(err).message
        });
    }
    return [primaryJid];
}
/**
 * Resolves the devices of the participants given none, like a 1:1 callee's. One left
 * unresolved keeps an empty list and is rung on its primary device.
 */
async function resolveOfferParticipantDevices(deps, participants, log) {
    const hasDevices = (participant) => (participant.devices?.length ?? 0) > 0;
    const unresolved = participants.filter((participant) => !hasDevices(participant));
    const devicesByAccount = new Map();
    if (unresolved.length > 0) {
        try {
            const synced = await deps.signalDeviceSync.syncDeviceList(unresolved.map((participant) => participant.jid));
            for (const entry of synced) {
                devicesByAccount.set((0, jid_js_1.groupParticipantAccountKey)(entry.jid), entry.deviceJids);
            }
        }
        catch (err) {
            log.debug('group offer device resolution failed, ringing primary devices', {
                unresolvedCount: unresolved.length,
                message: (0, util_1.toError)(err).message
            });
        }
    }
    return participants.map((participant) => ({
        jid: participant.jid,
        devices: hasDevices(participant)
            ? (participant.devices ?? [])
            : (devicesByAccount.get((0, jid_js_1.groupParticipantAccountKey)(participant.jid)) ?? [])
    }));
}
