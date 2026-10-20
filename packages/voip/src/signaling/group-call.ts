import { createNoopLogger, type Logger } from 'zapo-js'
import { normalizeDeviceJid, toUserJid } from 'zapo-js/protocol'
import { type BinaryNode, buildReceiptNode } from 'zapo-js/transport'

import type { WaCallGroupParticipant } from '../call/group-participants.js'
import { groupParticipantAccountKey } from '../jid.js'
import { resolveOfferParticipantDevices } from '../peer-devices.js'
import type { CallOfferParticipant, WaVoipDeps } from '../types.js'

import { deviceIdentityNode, encryptCallKeyForDevices } from './call-key.js'
import { callStanza, toCallServerJid } from './call-stanza.js'
import { normalizeParticipantDeviceJids } from './group-info.js'
import { buildOfferMediaNodes, CAPABILITY_OFFER, CAPABILITY_VIDEO_OFFER } from './lifecycle.js'

/** A group `<offer>` and the participants it named, creator first, devices addressed. */
interface GroupOfferStanza {
    readonly node: BinaryNode
    readonly participants: readonly WaCallGroupParticipant[]
}

/**
 * The most accounts a group `<offer>`'s `<group_info>` may name, ourselves included.
 *
 * Measured: the server refuses an offer that names more, with `error: '427'` on the
 * `<ack>` (`handleCallAck` -> `SetupFailed`). The ceiling is the roster bound the
 * official client enforces (`GroupInfoStanza.MAX_PARTICIPANTS = 0x7f`), not the
 * 32-participant limit of a *connected* call: a group of 128 members overflows it by
 * one, because the creator counts. Naming fewer is always accepted.
 */
export const WA_GROUP_OFFER_MAX_ACCOUNTS = 0x7f

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
    // Cap BEFORE resolving devices: a group of hundreds would otherwise resolve every
    // device (a fan-out lookup per account) only to drop most of them. The creator takes
    // the first roster slot, so at most `WA_GROUP_OFFER_MAX_ACCOUNTS - 1` others fit.
    const candidates = participants
        .filter((participant) => groupParticipantAccountKey(participant.jid) !== creatorKey)
        .slice(0, WA_GROUP_OFFER_MAX_ACCOUNTS - 1)
    const resolved = await resolveOfferParticipantDevices(deps, candidates, log)
    if (resolved.length === 0) {
        throw new Error(`group call on ${groupJid} has no participant to ring`)
    }

    const creator: WaCallGroupParticipant = {
        jid: toUserJid(callCreator),
        devices: normalizeParticipantDeviceJids(callCreator, [callCreator])
    }
    const listed: WaCallGroupParticipant[] = [creator]
    const users = [buildGroupUserNode(creator, isVideo ? CAPABILITY_VIDEO_OFFER : CAPABILITY_OFFER)]
    for (const participant of resolved) {
        const entry: WaCallGroupParticipant = {
            jid: toUserJid(participant.jid),
            devices: normalizeParticipantDeviceJids(participant.jid, participant.devices)
        }
        if (listed.length >= WA_GROUP_OFFER_MAX_ACCOUNTS) break
        listed.push(entry)
        users.push(buildGroupUserNode(entry))
    }

    // The roster is REQUIRED, voice chat or not: it is the caller's best known device set,
    // and it is what lets the server fan the offer to the participants at all. An offer that
    // omits it is accepted and then creates nothing -- no card, no call. What is capped is
    // its size (`WA_GROUP_OFFER_MAX_ACCOUNTS`): the server refuses a longer roster with
    // `error: '427'`, which is what kept a group of 128 out (the creator counts).
    //
    // The marker goes out under both spellings: `is_lightweight` is the one the official
    // client uses, `lightweight` is the one this package always wrote.
    const offerAttrs: Record<string, string> = isLightweight
        ? { 'group-jid': groupJid, is_lightweight: '1', lightweight: '1' }
        : { 'group-jid': groupJid }

    return {
        node: callStanza(toCallServerJid(callId), 'offer', callId, callCreator, offerAttrs, [
            ...buildOfferMediaNodes(isVideo, isLightweight),
            { tag: 'group_info', attrs: {}, content: users }
        ]),
        participants: listed
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
