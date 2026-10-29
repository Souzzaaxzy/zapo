import { canonicalizeSignalServer, parseSignalAddressFromJid, WA_DEFAULTS } from 'zapo-js/protocol';
import { findNodeChild, getNodeChildrenByTag } from 'zapo-js/transport';
import { tryAsNumber } from 'zapo-js/util';
import { addressDeviceJid } from '../jid.js';
const PRIMARY_DEVICE_ID = 0;
/** How many devices one participant may bring into a call; a longer list is refused whole. */
export const WA_CALL_MAX_DEVICES_PER_USER = 5;
function attrText(attrs, name) {
    const value = attrs[name];
    return value === undefined || value.length === 0 ? null : value;
}
/** Presence is the signal; the explicit negatives are honoured too. */
function attrFlag(attrs, name) {
    const value = attrText(attrs, name);
    return value !== null && value !== '0' && value.toLowerCase() !== 'false';
}
function isLidServer(server) {
    return canonicalizeSignalServer(server) === WA_DEFAULTS.LID_SERVER;
}
function withPrimaryFirst(items, deviceIdOf) {
    const index = items.findIndex((item) => deviceIdOf(item) === PRIMARY_DEVICE_ID);
    if (index <= 0)
        return items;
    return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
function parseDeviceNode(node, participantJid) {
    const attrs = node.attrs ?? {};
    const jid = attrText(attrs, 'jid');
    if (jid === null) {
        throw new Error(`group_info device of ${participantJid} carries no jid`);
    }
    const addressed = addressDeviceJid(jid);
    return {
        jid: addressed.jid,
        deviceId: addressed.deviceId,
        pid: tryAsNumber(attrs.pid),
        dec: attrText(attrs, 'dec'),
        enc: attrText(attrs, 'enc'),
        vidDec: attrText(attrs, 'vid_dec'),
        platform: attrText(attrs, 'platform'),
        capability: attrText(attrs, 'capability'),
        capabilityVersion: tryAsNumber(attrs.ver),
        capabilityBitMaskLength: tryAsNumber(attrs.bit_mask_length)
    };
}
function parseParticipantNode(node, isUserNode) {
    const attrs = node.attrs ?? {};
    const jid = attrText(attrs, 'jid');
    if (jid === null) {
        throw new Error(`group_info <${node.tag}> carries no jid`);
    }
    const reason = attrText(attrs, 'reason') ?? attrText(attrs, 'error');
    const nacked = reason !== null;
    const devices = getNodeChildrenByTag(node, 'device').map((child) => parseDeviceNode(child, jid));
    if (devices.length > WA_CALL_MAX_DEVICES_PER_USER) {
        throw new Error(`group_info participant ${jid} carries ${devices.length} devices, over the limit of ${WA_CALL_MAX_DEVICES_PER_USER}`);
    }
    if (isUserNode && nacked && devices.length > 0) {
        throw new Error(`group_info user ${jid} is nacked and still carries a device`);
    }
    if (isUserNode && !nacked && devices.length === 0) {
        throw new Error(`group_info user ${jid} is not nacked and carries no device`);
    }
    return {
        jid,
        nacked,
        reason,
        state: attrText(attrs, 'state'),
        phash: attrText(attrs, 'phash'),
        userPn: attrText(attrs, 'user_pn'),
        username: attrText(attrs, 'username'),
        pushName: attrText(attrs, 'push_name'),
        guestName: attrText(attrs, 'guest_name'),
        countryCode: attrText(attrs, 'country_code'),
        accountKind: attrText(attrs, 'account_kind'),
        tosNotAccepted: attrFlag(attrs, 'tos_not_accepted'),
        media: attrText(attrs, 'media'),
        rekey: attrFlag(attrs, 'rekey'),
        transactionId: tryAsNumber(attrs['transaction-id']),
        linkToken: attrText(attrs, 'link-token'),
        decExtensionId: attrText(attrs, 'decextension_id'),
        hnVideo: attrText(attrs, 'hn_video'),
        devices: withPrimaryFirst(devices, (device) => device.deviceId)
    };
}
/**
 * Reads a `<group_info>`. Throws on the stanzas the peer itself refuses: missing `media` or
 * `connected_limit`, `group_phash` with `lightweight_key`, `<user>` with `<participant>`, a
 * missing jid, more than {@link WA_CALL_MAX_DEVICES_PER_USER} devices, or a `<user>` whose
 * device count disagrees with its nack.
 */
export function parseGroupInfoNode(node) {
    const attrs = node.attrs ?? {};
    const media = attrText(attrs, 'media');
    if (media === null) {
        throw new Error('group_info carries no media');
    }
    const connectedLimit = tryAsNumber(attrs.connected_limit ?? attrs['connected-limit']);
    if (connectedLimit === null || !Number.isSafeInteger(connectedLimit) || connectedLimit < 0) {
        throw new Error('group_info carries no valid connected_limit');
    }
    const groupPhash = attrText(attrs, 'group_phash');
    const lightweightKey = attrText(attrs, 'lightweight_key');
    if (groupPhash !== null && lightweightKey !== null) {
        throw new Error('group_info carries both group_phash and lightweight_key');
    }
    const userNodes = getNodeChildrenByTag(node, 'user');
    const participantNodes = getNodeChildrenByTag(node, 'participant');
    if (userNodes.length > 0 && participantNodes.length > 0) {
        throw new Error('group_info carries both <user> and <participant> children');
    }
    const isUserNode = userNodes.length > 0;
    const listed = isUserNode ? userNodes : participantNodes;
    return {
        media,
        connectedLimit,
        rekey: attrFlag(attrs, 'rekey'),
        transactionId: tryAsNumber(attrs['transaction-id']),
        linkToken: attrText(attrs, 'link-token'),
        phash: attrText(attrs, 'phash'),
        groupPhash,
        lightweightKey,
        extensionId: attrText(attrs, 'decextension') ?? attrText(attrs, 'extension_id'),
        participantTag: listed.length === 0 ? null : isUserNode ? 'user' : 'participant',
        participants: listed.map((child) => parseParticipantNode(child, isUserNode))
    };
}
/**
 * Reads the `<group_info>` an OFFER shipped, given either the `<call>` envelope or the `<offer>`
 * itself.
 *
 * <p>The `<group_info>` hangs off the `<offer>`, never off the `<call>` envelope. Looking for it on
 * the envelope finds nothing and answers "no roster" for EVERY offer -- which is exactly what made
 * the `group offer sent` log report `rosterShipped: false` / `rosterAccounts: 0` even when the
 * roster was there. A log that always says the same thing hides the very thing it exists to show.
 *
 * @param node the `<call>` envelope or the `<offer>` node
 */
export function describeOfferRoster(node) {
    const inner = findNodeChild(node, 'offer') ?? node;
    const roster = findNodeChild(inner, 'group_info');
    if (!roster)
        return { shipped: false, accounts: 0, form: 'none', phash: null };
    const phash = roster.attrs?.phash ?? null;
    const accounts = Array.isArray(roster.content) ? roster.content.length : 0;
    return { shipped: true, accounts, form: phash ? 'hash' : 'list', phash };
}
/** The participants of a parsed `<group_info>` in the shape the reconciler reads. */
export function toGroupCallParticipants(info) {
    return info.participants.map((participant) => {
        const withPid = participant.devices.filter((device) => device.pid !== null);
        return {
            jid: participant.jid,
            devices: participant.devices.map((device) => device.jid),
            state: participant.state ?? undefined,
            nacked: participant.nacked,
            ...(withPid.length > 0 && {
                devicePids: Object.fromEntries(withPid.map((device) => [device.jid, device.pid]))
            })
        };
    });
}
/**
 * Reads the roster off an `<offer>` or `<group_update>`. A `<group_info>` listing nobody is
 * `empty` and treated as no roster: emptying a live call cannot be undone, keeping it can.
 *
 * @throws through {@link parseGroupInfoNode}.
 */
export function readGroupCallRoster(inner) {
    const groupInfoNode = findNodeChild(inner, 'group_info');
    if (!groupInfoNode)
        return { kind: 'absent' };
    const info = parseGroupInfoNode(groupInfoNode);
    const participants = toGroupCallParticipants(info);
    if (participants.length === 0)
        return { kind: 'empty' };
    return { kind: 'roster', info, participants };
}
/** The `transaction-id` of a `group_update`: its `<group_info>`'s, else the wrapper's. */
export function readGroupUpdateTransactionId(inner) {
    return (tryAsNumber(findNodeChild(inner, 'group_info')?.attrs?.['transaction-id']) ??
        tryAsNumber(inner.attrs?.['transaction-id']));
}
/**
 * The number a `group_update` is ordered by: its `<group_info>`'s, else the wrapper's, else the
 * highest a participant carries, else one past the last applied.
 */
export function resolveGroupUpdateTransactionId(inner, listed, lastTransactionId, rosterTransactionId) {
    if (rosterTransactionId !== null)
        return rosterTransactionId;
    const own = tryAsNumber(inner.attrs?.['transaction-id']);
    if (own !== null)
        return own;
    let highest = null;
    for (const participant of listed) {
        const id = participant.transactionId;
        if (id !== null && (highest === null || id > highest))
            highest = id;
    }
    return highest ?? (lastTransactionId ?? 0) + 1;
}
/**
 * The devices a participant addresses, each with its `:device`, primary first. A count
 * outside one to five collapses onto the primary device of the user jid.
 *
 * @throws when the user jid and its devices disagree on being a LID.
 */
export function normalizeParticipantDeviceJids(userJid, deviceJids) {
    const user = parseSignalAddressFromJid(userJid);
    const userServer = user.server ?? WA_DEFAULTS.HOST_DOMAIN;
    if (deviceJids.length < 1 || deviceJids.length > WA_CALL_MAX_DEVICES_PER_USER) {
        return [`${user.user}:${PRIMARY_DEVICE_ID}@${userServer}`];
    }
    const userIsLid = isLidServer(userServer);
    const userIdentity = `${user.user}@${canonicalizeSignalServer(userServer)}`;
    const resolved = deviceJids.map((jid) => {
        const addressed = addressDeviceJid(jid);
        if (isLidServer(addressed.server) !== userIsLid) {
            throw new Error(`participant ${userJid} mixes LID and non-LID device jids`);
        }
        const deviceUser = parseSignalAddressFromJid(jid).user;
        if (`${deviceUser}@${canonicalizeSignalServer(addressed.server)}` !== userIdentity) {
            throw new Error(`device ${jid} is not a device of participant ${userJid}`);
        }
        return addressed;
    });
    return withPrimaryFirst(resolved, (entry) => entry.deviceId).map((entry) => entry.jid);
}
