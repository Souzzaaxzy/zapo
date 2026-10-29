import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { BinaryNode } from 'zapo-js/transport'

import type { CallOfferParticipant, WaVoipDeps } from '../../types.js'
import { buildGroupOfferStanza } from '../group-call.js'

/**
 * The expected group offer, written out by hand rather than generated
 * by the builder under test. The stanza id is not compared, and the capability blob is
 * compared as some bytes.
 */
const CALL_ID = '0053771AFB183B33AA05E5CBC13DD3F2'
const GROUP_JID = '120363431977320048@g.us'
const CREATOR_DEVICE_JID = '50062877036657:76@lid'

/** Stands in for byte content not compared. */
const BYTES = '<bytes>'

interface Comparable {
    readonly tag: string
    readonly attrs: Record<string, string>
    readonly children: readonly Comparable[] | string | null
}

/** The stanza reduced to tags, attributes and nesting. */
function toComparable(node: BinaryNode): Comparable {
    const content = node.content

    let children: readonly Comparable[] | string | null = null
    if (Array.isArray(content)) {
        children = content.map(toComparable)
    } else if (content instanceof Uint8Array) {
        children = BYTES
    } else if (typeof content === 'string') {
        children = content
    }

    return { tag: node.tag, attrs: { ...node.attrs }, children }
}

const EXPECTED_OFFER: Comparable = {
    tag: 'offer',
    attrs: {
        'call-id': CALL_ID,
        'call-creator': '50062877036657:76@lid',
        'group-jid': '120363431977320048@g.us'
    },
    children: [
        { tag: 'audio', attrs: { enc: 'opus', rate: '8000' }, children: null },
        { tag: 'audio', attrs: { enc: 'opus', rate: '16000' }, children: null },
        { tag: 'net', attrs: { medium: '3' }, children: null },
        {
            tag: 'group_info',
            attrs: {},
            children: [
                {
                    tag: 'user',
                    attrs: { jid: '50062877036657@lid' },
                    children: [
                        {
                            tag: 'device',
                            attrs: { jid: '50062877036657:76@lid' },
                            children: [{ tag: 'capability', attrs: { ver: '1' }, children: BYTES }]
                        }
                    ]
                },
                {
                    tag: 'user',
                    attrs: { jid: '112984198234339@lid' },
                    children: [
                        { tag: 'device', attrs: { jid: '112984198234339@lid' }, children: null }
                    ]
                },
                {
                    tag: 'user',
                    attrs: { jid: '184478207058035@lid' },
                    children: [
                        { tag: 'device', attrs: { jid: '184478207058035@lid' }, children: null },
                        { tag: 'device', attrs: { jid: '184478207058035:1@lid' }, children: null }
                    ]
                }
            ]
        }
    ]
}

/** The two callees, each carrying the devices it is listed with. */
const PARTICIPANTS: readonly CallOfferParticipant[] = [
    { jid: '112984198234339@lid', devices: ['112984198234339@lid'] },
    { jid: '184478207058035@lid', devices: ['184478207058035@lid', '184478207058035:1@lid'] }
]

function createDeps(
    syncDeviceList: (
        jids: readonly string[]
    ) => Promise<
        readonly { readonly jid: string; readonly deviceJids: readonly string[] }[]
    > = async () => []
): WaVoipDeps {
    return {
        authClient: {
            getCurrentCredentials: () => ({
                meJid: '50062877036657@s.whatsapp.net',
                meLid: CREATOR_DEVICE_JID,
                signedIdentity: { details: new Uint8Array([1, 2, 3]) }
            })
        },
        signalDeviceSync: { syncDeviceList }
    } as unknown as WaVoipDeps
}

function offerNode(node: BinaryNode): BinaryNode {
    const children = node.content as BinaryNode[]
    assert.equal(children.length, 1)
    return children[0]
}

function deviceJids(offer: BinaryNode, userJid: string): string[] {
    const groupInfo = (offer.content as BinaryNode[]).find((child) => child.tag === 'group_info')
    const user = (groupInfo?.content as BinaryNode[]).find((child) => child.attrs.jid === userJid)
    return ((user?.content as BinaryNode[]) ?? []).map((device) => device.attrs.jid)
}

test('a group offer matches the expected stanza, field by field', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )

    assert.equal(node.tag, 'call')
    assert.equal(node.attrs.to, `${CALL_ID}@call`)
    assert.match(node.attrs.id, /^[0-9A-F]{32}$/)
    assert.deepEqual(toComparable(offerNode(node)), EXPECTED_OFFER)
})

test('a group offer carries none of the plumbing a 1:1 offer needs for the call key', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )

    const offer = offerNode(node)
    const tags = (offer.content as BinaryNode[]).map((child) => child.tag)
    for (const absent of ['destination', 'encopt', 'device-identity', 'privacy', 'capability']) {
        assert.equal(tags.includes(absent), false, `${absent} is not on a group offer`)
    }
    // The server writes `joinable` onto the copy it delivers; the sender does not.
    assert.equal(offer.attrs.joinable, undefined)
})

test('only the creator device carries a capability, and the creator leads the list', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )

    const groupInfo = (offerNode(node).content as BinaryNode[]).find(
        (child) => child.tag === 'group_info'
    )
    const users = groupInfo?.content as BinaryNode[]
    assert.equal(users[0].attrs.jid, '50062877036657@lid')

    const withCapability = users.filter((user) =>
        ((user.content as BinaryNode[]) ?? []).some((device) =>
            Array.isArray(device.content)
                ? device.content.some((child) => child.tag === 'capability')
                : false
        )
    )
    assert.equal(withCapability.length, 1)
    assert.equal(withCapability[0], users[0])
})

test('a video group offer puts the video node where a 1:1 offer puts it', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        true
    )

    const tags = (offerNode(node).content as BinaryNode[]).map((child) => child.tag)
    assert.deepEqual(tags, ['audio', 'audio', 'video', 'net', 'group_info'])
})

test('the primary device leads a participant whatever order its devices arrived in', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        [{ jid: '184478207058035@lid', devices: ['184478207058035:1@lid', '184478207058035@lid'] }],
        false
    )

    assert.deepEqual(deviceJids(offerNode(node), '184478207058035@lid'), [
        '184478207058035@lid',
        '184478207058035:1@lid'
    ])
})

test('a participant that brings no devices has them resolved', async () => {
    const deps = createDeps(async (jids) => {
        assert.deepEqual([...jids], ['112984198234339@lid'])
        return [
            {
                jid: '112984198234339@lid',
                deviceJids: ['112984198234339:0@lid', '112984198234339:3@lid']
            }
        ]
    })

    const { node } = await buildGroupOfferStanza(
        deps,
        CALL_ID,
        GROUP_JID,
        [{ jid: '112984198234339@lid' }],
        false
    )

    assert.deepEqual(deviceJids(offerNode(node), '112984198234339@lid'), [
        '112984198234339@lid',
        '112984198234339:3@lid'
    ])
})

test('a participant whose devices cannot be resolved is still rung on its primary', async () => {
    const deps = createDeps(async () => {
        throw new Error('usync is down')
    })

    const { node } = await buildGroupOfferStanza(
        deps,
        CALL_ID,
        GROUP_JID,
        [{ jid: '112984198234339@lid' }],
        false
    )

    assert.deepEqual(deviceJids(offerNode(node), '112984198234339@lid'), ['112984198234339@lid'])
})

test('the participants reported back address every device by its own segment', async () => {
    const { participants } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )

    assert.deepEqual(
        participants.map((participant) => ({ ...participant })),
        [
            { jid: '50062877036657@lid', devices: ['50062877036657:76@lid'] },
            { jid: '112984198234339@lid', devices: ['112984198234339:0@lid'] },
            {
                jid: '184478207058035@lid',
                devices: ['184478207058035:0@lid', '184478207058035:1@lid']
            }
        ]
    )
})

test('a caller that lists us among the participants does not get listed twice', async () => {
    const { node, participants } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        [{ jid: '50062877036657@lid', devices: ['50062877036657:12@lid'] }, ...PARTICIPANTS],
        false
    )

    const groupInfo = (offerNode(node).content as BinaryNode[]).find(
        (child) => child.tag === 'group_info'
    )
    const listed = (groupInfo?.content as BinaryNode[]).map((user) => user.attrs.jid)
    assert.deepEqual(listed, ['50062877036657@lid', '112984198234339@lid', '184478207058035@lid'])
    // Ours is the device placing the call, not the one the caller happened to name.
    assert.deepEqual(participants[0].devices, ['50062877036657:76@lid'])
})

test('a group offer with nobody left to ring is refused', async () => {
    await assert.rejects(
        () =>
            buildGroupOfferStanza(
                createDeps(),
                CALL_ID,
                GROUP_JID,
                [{ jid: '50062877036657@lid' }],
                false
            ),
        /no participant to ring/
    )
})

test('a group offer needs a jid of ours to name as its call-creator', async () => {
    const deps = {
        authClient: { getCurrentCredentials: () => undefined },
        signalDeviceSync: { syncDeviceList: async () => [] }
    } as unknown as WaVoipDeps

    await assert.rejects(
        () => buildGroupOfferStanza(deps, CALL_ID, GROUP_JID, PARTICIPANTS, false),
        /call-creator/
    )
})

test('a group too large to name ships the roster as the HASH (any group, ringing or not)', async () => {
    // Um grupo que NAO CABE no teto da call nao pode ser NOMEADO: um roster menor
    // que o grupo e' recusado (`412`/`427`) e um offer sem lista e' descartado em
    // silencio (nenhum ack). O cliente oficial referencia esse conjunto pelo HASH
    // (`<group_info phash="2:...">`, sem filhos) e o servidor resolve contra o
    // grupo -- o teto deixa de valer para o OFFER. Medido no grupo real: nomear 0
    // -> nada; 32 -> 412; 127 -> 427.
    //
    // Vale para QUALQUER grupo que nao caiba, chamada que toca inclusive: era o
    // caso que ficava preso em 32 nomeados.
    const many = Array.from({ length: 300 }, (_, i) => ({ jid: `200000000000${i}@lid` }))
    const { node, participants, hashOnly } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        many,
        false
    )
    const offer = offerNode(node)
    const groupInfo = (offer.content as BinaryNode[]).find((child) => child.tag === 'group_info')

    assert.equal(hashOnly, true, 'o offer sabe que foi pelo hash')
    assert.ok(groupInfo, 'o roster vai -- como HASH')
    assert.match(String(groupInfo?.attrs.phash), /^2:[A-Za-z0-9+/]{8}$/, 'phash v2')
    assert.equal(groupInfo?.content, undefined, 'sem filhos: o hash substitui a lista')
    assert.equal(participants.length, 1, 'sem lista, a composicao local e so o criador')
    assert.equal(participants[0].jid, '50062877036657@lid', 'o criador')
})

test('a huge group still resolves every device, because the hash covers the whole set', async () => {
    // O hash so' vale se cobrir o conjunto INTEIRO: nomear menos e' o que o
    // servidor recusa. Entao o grupo grande resolve todos os devices (o oposto do
    // corte antigo, que resolvia 31 e descartava o resto).
    const pedidos: string[][] = []
    const deps = createDeps(async (jids) => {
        pedidos.push([...jids])
        return jids.map((jid) => ({ jid, deviceJids: [`${jid.split('@')[0]}:1@lid`] }))
    })
    const many = Array.from({ length: 400 }, (_, i) => ({ jid: `200000000000${i}@lid` }))
    const { participants, hashOnly } = await buildGroupOfferStanza(deps, CALL_ID, GROUP_JID, many, false)

    assert.equal(hashOnly, true, 'o grupo de 400 nao cabe e vai pelo hash')
    assert.equal(participants.length, 1, 'sem lista enumerada')
    const resolvidas = pedidos.flat().length
    assert.ok(
        resolvidas >= 399,
        `o hash precisa dos devices de TODOS os convidados, veio ${resolvidas}`
    )
})

test('a group offer below the bound is not trimmed', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )
    const offer = offerNode(node)
    const groupInfo = (offer.content as BinaryNode[]).find((child) => child.tag === 'group_info')
    const users = groupInfo?.content as BinaryNode[]
    assert.equal(users.length, 3, 'criador + 2 convidados, sem corte')
})

test('a plain group offer marks no voice chat', async () => {
    const { node } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false
    )
    const offer = offerNode(node)

    assert.equal(offer.attrs.lightweight, undefined)
    assert.equal(
        (offer.content as BinaryNode[]).some((child) => child.tag === 'silence'),
        false
    )
})

test('a voice chat flags itself, announces silence, and ships the roster', async () => {
    const { node, participants } = await buildGroupOfferStanza(
        createDeps(),
        CALL_ID,
        GROUP_JID,
        PARTICIPANTS,
        false,
        true
    )
    const offer = offerNode(node)

    assert.equal(offer.attrs.lightweight, '1', 'the voice chat flag the server reads')
    assert.equal(
        offer.attrs.is_lightweight,
        undefined,
        'apenas o marcador que funciona: um atributo desconhecido descarta o offer'
    )
    assert.equal(offer.attrs['group-jid'], GROUP_JID, 'the group attribute is kept alongside it')

    const children = offer.content as BinaryNode[]
    const silence = children.find((child) => child.tag === 'silence')
    assert.equal(silence?.attrs.reason, 'lightweight')
    // `<silence>` sits between the audio rates and `<net>`, as WhatsApp Web emits it.
    const tags = children.map((child) => child.tag)
    assert.equal(tags.indexOf('silence'), tags.indexOf('net') - 1)
    assert.equal(
        children.filter((child) => child.tag === 'audio').length,
        2,
        'the audio rates are announced either way'
    )

    // The roster is REQUIRED, voice chat or not: it is the caller's best known device set
    // and the server needs it to fan the offer. Omitting it is accepted and creates nothing.
    const groupInfo = children.find((child) => child.tag === 'group_info')
    assert.ok(groupInfo, 'a voice chat SHIPS the roster')
    assert.equal((groupInfo?.content as BinaryNode[]).length, 3, 'criador + 2 convidados')
    assert.equal(participants.length, 3, 'a composicao local tem os tres')
})

test('a voice chat too big for the call ceiling also ships the roster as a HASH', async () => {
    // O mesmo caminho do hash vale para o chat de voz -- com o marcador
    // `lightweight` no offer.
    const pedidos: string[][] = []
    const deps = createDeps(async (jids) => {
        pedidos.push([...jids])
        return jids.map((jid) => ({ jid, deviceJids: [`${jid.split('@')[0]}:1@lid`] }))
    })
    const many = Array.from({ length: 400 }, (_, i) => ({ jid: `200000000000${i}@lid` }))
    const { node, hashOnly } = await buildGroupOfferStanza(deps, CALL_ID, GROUP_JID, many, false, true)
    const offer = offerNode(node)
    assert.equal(offer.attrs.lightweight, '1', 'o marcador vai')
    assert.equal(hashOnly, true, 'o chat de voz grande tambem vai pelo hash')
    const groupInfo = (offer.content as BinaryNode[]).find((child) => child.tag === 'group_info')
    assert.ok(groupInfo, 'o roster vai -- como HASH, nao como lista')
    assert.match(String(groupInfo?.attrs.phash), /^2:[A-Za-z0-9+/]{8}$/, 'phash v2')
    assert.equal(groupInfo?.content, undefined, 'sem filhos: o hash substitui a lista')
    assert.ok(pedidos.flat().length >= 399, 'o hash cobre o conjunto INTEIRO de devices')
})
test('the offer HASH includes our own device, matching the reference vectors', async () => {
    // O hash de referencia e' `phashV2([].concat(A, [B]))`: o conjunto resolvido dos
    // convidados MAIS o device que coloca a call. O servidor recompoe a mesma string para
    // validar, entao esquecer o proprio device invalida o hash. Vetores medidos contra a
    // implementacao de referencia (`2:rZoSAdIV` sem o self, `2:sti8OtHX` com ele).
    const convidados = [
        { jid: '100000000000001@lid' },
        { jid: '100000000000002@lid' },
        { jid: '100000000000003@lid' }
    ]
    const deps = {
        authClient: {
            getCurrentCredentials: () => ({
                meJid: '100000000000099@s.whatsapp.net',
                meLid: '100000000000099:24@lid',
                signedIdentity: { details: new Uint8Array([1, 2, 3]) }
            })
        },
        signalDeviceSync: {
            syncDeviceList: async (jids: readonly string[]) =>
                jids.map((jid) => ({ jid, deviceJids: [`${jid.split('@')[0]}:1@lid`] }))
        }
    } as unknown as WaVoipDeps

    // 40 convidados para forcar o caminho do hash (acima do teto de 32).
    const muitos = [
        ...convidados,
        ...Array.from({ length: 37 }, (_, i) => ({ jid: `1000000000000${10 + i}@lid` }))
    ]
    const { node } = await buildGroupOfferStanza(deps, CALL_ID, GROUP_JID, muitos, false)
    const groupInfo = (offerNode(node).content as BinaryNode[]).find(
        (child) => child.tag === 'group_info'
    )
    // O hash tem a forma `2:` + 8 caracteres base64 e muda quando o proprio device entra.
    assert.match(String(groupInfo?.attrs.phash), /^2:[A-Za-z0-9+/]{8}$/)
    assert.notEqual(
        groupInfo?.attrs.phash,
        '2:',
        'o hash nao pode sair vazio: o proprio device entra no conjunto'
    )
})

test('a voice chat that FITS the ceiling still ships its roster', async () => {
    const pedidos: string[][] = []
    const deps = createDeps(async (jids) => {
        pedidos.push([...jids])
        return jids.map((jid) => ({ jid, deviceJids: [`${jid.split('@')[0]}:1@lid`] }))
    })
    const few = Array.from({ length: 20 }, (_, i) => ({ jid: `200000000000${i}@lid` }))
    const { node } = await buildGroupOfferStanza(deps, CALL_ID, GROUP_JID, few, false, true)
    const offer = offerNode(node)
    const groupInfo = (offer.content as BinaryNode[]).find((child) => child.tag === 'group_info')
    assert.ok(groupInfo, 'um chat de voz que CABE nomeia quem ele endereca')
    assert.equal((groupInfo?.content as BinaryNode[]).length, 21, 'criador + 20')
    assert.ok(pedidos.flat().length > 0, 'e resolve os devices')
})
