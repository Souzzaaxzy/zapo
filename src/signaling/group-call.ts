import { createNoopLogger, type Logger } from 'zapo-js'
import { normalizeDeviceJid, toUserJid } from 'zapo-js/protocol'
import { type BinaryNode, buildReceiptNode } from 'zapo-js/transport'

import type { WaCallGroupParticipant } from '../call/group-participants.js'
import { groupParticipantAccountKey, toDeviceJid } from '../jid.js'
import { resolveOfferParticipantDevices } from '../peer-devices.js'
import type { CallOfferParticipant, WaVoipDeps } from '../types.js'

import { deviceIdentityNode, encryptCallKeyForDevices } from './call-key.js'
import { callStanza, toCallServerJid } from './call-stanza.js'
import { normalizeParticipantDeviceJids } from './group-info.js'
import { buildOfferMediaNodes, CAPABILITY_OFFER, CAPABILITY_VIDEO_OFFER } from './lifecycle.js'
import { computePhashV2 } from './phash.js'

/** A group `<offer>` and the participants it named, creator first, devices addressed. */
interface GroupOfferStanza {
    readonly node: BinaryNode
    readonly participants: readonly WaCallGroupParticipant[]
    /**
     * Whether the roster shipped as the participant-set HASH instead of a list, which is what
     * an offer does for a group too large to name. There is no peer to address in that case,
     * so the caller targets the call itself.
     */
    readonly hashOnly: boolean
}

/**
 * The most accounts a group `<offer>`'s `<group_info>` may name, ourselves included.
 *
 * This is the server's group-call participant ceiling, the `group_call_max_participants`
 * AB prop (32 by default), not the 127-entry wire bound on a `<group_info>` element: the
 * server refuses an offer that names more than the call may hold, with `error: '427'` and
 * `error: '412'` on the `<ack>` (`handleCallAck` -> `SetupFailed`). Measured: 32 is
 * accepted, 127 is refused. The official client applies the same gate before placing a
 * group call. Naming fewer is always accepted, so a larger group still starts and the
 * rest joins from the app.
 */
export const WA_GROUP_OFFER_MAX_ACCOUNTS = 32

/**
 * The participant-set hash (`2:<base64>`) of a group's resolved device set, or `null` when
 * there is nothing to hash.
 *
 * <p>Every device of every participant goes into the hash -- that is the whole point: it
 * stands in for the list we cannot write. The participants' own jids are added when a
 * member resolved to no device, so a member is never silently dropped from the set.
 *
 * <p>Our own device is added too. The reference hashes `phashV2([].concat(A, [B]))`, where
 * `A` is the resolved recipient set and `B` the sending device: the device that places the
 * call is part of the set, and the server recomputes the same string to validate it.
 * Confirmed against the reference vectors (`2:rZoSAdIV` without it, `2:sti8OtHX` with it).
 */
function phashOfGroup(
    resolved: readonly { readonly jid: string; readonly devices: readonly string[] }[],
    ownDeviceJid: string
): string | null {
    const devices = new Set<string>()
    for (const participant of resolved) {
        if (participant.devices.length === 0) {
            devices.add(toDeviceJid(participant.jid))
            continue
        }
        for (const device of participant.devices) devices.add(device)
    }
    devices.add(ownDeviceJid)
    if (devices.size === 0) return null
    return computePhashV2([...devices])
}

function buildGroupUserNode(
    participant: WaCallGroupParticipant,
    capability?: Uint8Array
): BinaryNode {
    return {
        tag: 'user',
        attrs: { jid: participant.jid },
        content: participant.devices.map((deviceJid) => ({
            tag: 'device',
            attrs: { jid: normalizeDeviceJid(deviceJid) },
            content: capability
                ? [{ tag: 'capability', attrs: { ver: '1' }, content: capability }]
                : undefined
        }))
    }
}

/**
 * Builds the `<offer>` that places a group call: addressed to `<call-id>@call`, with the
 * participants in an attribute-less `<group_info>` (creator first, with only the device placing the
 * call, the only one carrying a `<capability>`) and no `<destination>`, `<enc>`, `<encopt>` or `<device-identity>`: the key
 * arrives later over `enc_rekey`. The server fills `joinable` and the `<group_info>` attributes.
 *
 * `isLightweight` places a voice chat instead of a ringing call: the offer carries `lightweight='1'`
 * and announces `<silence>`, so joining the group does not make everyone's phone ring. See
 * {@link buildOfferMediaNodes}.
 *
 * @throws with no own jid, with nobody left to ring, or through
 * {@link normalizeParticipantDeviceJids}.
 */
export async function buildGroupOfferStanza(
    deps: WaVoipDeps,
    callId: string,
    groupJid: string,
    participants: readonly CallOfferParticipant[],
    isVideo: boolean,
    isLightweight = false,
    logger?: Logger
): Promise<GroupOfferStanza> {
    const log = logger ?? createNoopLogger()
    const creds = deps.authClient.getCurrentCredentials()
    const callCreator = creds?.meLid || creds?.meJid || ''
    if (!callCreator) {
        throw new Error('a group call offer has no jid of ours to name as its call-creator')
    }

    const creatorKey = groupParticipantAccountKey(callCreator)
    const others = participants.filter(
        (participant) => groupParticipantAccountKey(participant.jid) !== creatorKey
    )
    // A group that does not fit the call ceiling cannot be NAMED: a roster shorter than the
    // group is refused (`412`/`427`) and an offer naming nobody is dropped in silence (no
    // ack at all). The official client references such a set by its HASH instead -- a
    // `<group_info phash="2:...">` with no `<user>` children -- and the server resolves it
    // against the group, so the ceiling stops applying to the OFFER: the call is placed
    // against the whole group and whoever wants to join does so from the app.
    //
    // The hash path is taken by ANY overflowing group, ringing call or voice chat: the
    // hash is how a set too large to write is referenced, and a ringing call needs it just
    // as much as a voice chat does (naming 32 of a 400-member group is what gets refused).
    // Capping BEFORE resolving devices keeps a group of hundreds from resolving every
    // device only to drop most: the hash only needs the devices, not the account split.
    const overflows = others.length > WA_GROUP_OFFER_MAX_ACCOUNTS - 1
    const candidates = overflows ? others : others.slice(0, WA_GROUP_OFFER_MAX_ACCOUNTS - 1)
    const resolved = await resolveOfferParticipantDevices(deps, candidates, log)
    if (resolved.length === 0 && !overflows) {
        throw new Error(`group call on ${groupJid} has no participant to ring`)
    }

    const creator: WaCallGroupParticipant = {
        jid: toUserJid(callCreator),
        devices: normalizeParticipantDeviceJids(callCreator, [callCreator])
    }
    const listed: WaCallGroupParticipant[] = [creator]
    const users = [buildGroupUserNode(creator, isVideo ? CAPABILITY_VIDEO_OFFER : CAPABILITY_OFFER)]
    if (!overflows) {
        for (const participant of resolved) {
            const entry: WaCallGroupParticipant = {
                jid: toUserJid(participant.jid),
                devices: normalizeParticipantDeviceJids(participant.jid, participant.devices)
            }
            if (listed.length >= WA_GROUP_OFFER_MAX_ACCOUNTS) break
            listed.push(entry)
            users.push(buildGroupUserNode(entry))
        }
    }

    // The offer carries exactly two things that make a voice chat, and nothing else: the
    // `lightweight='1'` marker and the `<silence>` node `buildOfferMediaNodes` adds. Adding
    // further attributes is not free -- an attribute the server does not know makes it drop
    // the offer, and the call is accepted and then never appears.
    //
    // The roster is REQUIRED, voice chat or not: it is the caller's best known device set,
    // and it is what lets the server fan the offer to the participants at all. Omitting it
    // is accepted and then creates nothing. What changes is its SHAPE: an enumerated
    // `<group_info>` when the group fits (`WA_GROUP_OFFER_MAX_ACCOUNTS`; a longer roster is
    // refused with `error: '427'`), or the participant-set HASH when it does not.
    const offerContent = buildOfferMediaNodes(isVideo, isLightweight)
    if (overflows) {
        // No participant resolved to a device means there is no set to hash; the enumerated
        // path would have thrown, so keep the offer well formed by omitting the roster.
        const phash = phashOfGroup(resolved, toDeviceJid(callCreator))
        if (phash !== null) {
            offerContent.push({ tag: 'group_info', attrs: { phash }, content: undefined })
        }
    } else {
        offerContent.push({ tag: 'group_info', attrs: {}, content: users })
    }

    return {
        node: callStanza(
            toCallServerJid(callId),
            'offer',
            callId,
            callCreator,
            isLightweight ? { 'group-jid': groupJid, lightweight: '1' } : { 'group-jid': groupJid },
            offerContent
        ),
        participants: listed,
        hashOnly: overflows
    }
}

interface EncRekeyStanzaParams {
    readonly callId: string
    readonly callCreator: string
    /** The `transaction-id` of the `<group_info>` that asked for this rekey. */
    readonly transactionId: number
    readonly peerDeviceJid: string
    /** The new 32-byte call key, already installed on this side. */
    readonly callKey: Uint8Array
}

/**
 * Builds the `<enc_rekey>` carrying a new call key to one device: `transaction-id` echoing the
 * `<group_info>` that asked, `<encopt keygen='2'/>`, a direct `<enc>`, `<device-identity>` on a `pkmsg`.
 *
 * @throws when there is no Signal session for the device; a fan-out contains it per device.
 */
export async function buildEncRekeyStanza(
    deps: WaVoipDeps,
    params: EncRekeyStanzaParams
): Promise<BinaryNode> {
    const { encNodes, shouldIncludeDeviceIdentity } = await encryptCallKeyForDevices(
        deps,
        [params.peerDeviceJid],
        params.callKey
    )
    const encNode = encNodes[0]
    if (!encNode) {
        throw new Error(`the call key was not encrypted for ${params.peerDeviceJid}`)
    }

    const content: BinaryNode[] = [{ tag: 'encopt', attrs: { keygen: '2' } }, encNode]
    const creds = deps.authClient.getCurrentCredentials()
    if (shouldIncludeDeviceIdentity && creds?.signedIdentity) {
        content.push(deviceIdentityNode(creds.signedIdentity))
    }

    return callStanza(
        params.peerDeviceJid,
        'enc_rekey',
        params.callId,
        params.callCreator,
        { 'transaction-id': String(params.transactionId) },
        content
    )
}

/**
 * Builds the `<call><heartbeat>` every connected member of a group call sends the call itself,
 * every 10 s, whether it answered, placed or joined the call.
 */
export function buildHeartbeatStanza(callId: string, callCreator: string): BinaryNode {
    return callStanza(toCallServerJid(callId), 'heartbeat', callId, callCreator)
}

/** The `state` a `<peer_state>` reports for a peer; only `Invisible` has been seen on the wire. */
export const WA_PEER_STATE = Object.freeze({ Invisible: 'invisible', Visible: 'visible' } as const)

/** One of the values of {@link WA_PEER_STATE}. */
type WaPeerState = (typeof WA_PEER_STATE)[keyof typeof WA_PEER_STATE]

/**
 * Builds the `<call><peer_state>` telling the server what this side sees of one group-call member,
 * named by its account (a device suffix is dropped). `Invisible` is a member whose media stopped
 * reaching us; the server takes it off the call. `t` is in epoch milliseconds.
 */
export function buildPeerStateStanza(
    callId: string,
    callCreator: string,
    peerAccountJid: string,
    state: WaPeerState,
    nowMs: number = Date.now()
): BinaryNode {
    return callStanza(
        toCallServerJid(callId),
        'peer_state',
        callId,
        callCreator,
        { t: String(Math.floor(nowMs)) },
        [{ tag: 'user', attrs: { state, jid: toUserJid(peerAccountJid) } }]
    )
}

/**
 * Builds the `<receipt>` answering an `<enc_rekey>`, sent whether or not its key decrypted;
 * the child names the call, `call-creator` before `call-id`.
 */
export function buildEncRekeyReceiptStanza(
    peerDeviceJid: string,
    rekeyMsgId: string,
    callId: string,
    callCreator: string,
    ourJid: string
): BinaryNode {
    return buildReceiptNode({
        kind: 'custom',
        attrs: { to: peerDeviceJid, id: rekeyMsgId, from: ourJid },
        content: [{ tag: 'enc_rekey', attrs: { 'call-creator': callCreator, 'call-id': callId } }]
    })
}
