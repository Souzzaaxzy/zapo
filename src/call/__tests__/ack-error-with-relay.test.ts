/**
 * Um ack de offer com `error` MAS com `<relay>` NAO e' recusa: o relay so' e'
 * alocado para uma call que EXISTE. Antes o motor encerrava em qualquer erro,
 * jogando fora uma call que o servidor ja' tinha criado ("sobe e cai na hora").
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { buildOfferAckNode } from './_call-manager-fixtures.js'
import { createSession } from './_group-session.js'

const CALL_ID = 'C7C48C502D003F5DDC79BA112681F8A7'

/** The ack the server sends to our group offer, with an `error` on the envelope. */
function ackWithError(withRelay: boolean) {
    const ack = buildOfferAckNode(CALL_ID, ['50062877036657:76@lid'])
    return {
        ...ack,
        attrs: { ...ack.attrs, error: '207' },
        content: withRelay
            ? ack.content
            : (ack.content as readonly unknown[]).filter(
                  (child) => (child as { tag?: string }).tag !== 'relay'
              )
    }
}

test('ack com error E relay: a call CONTINUA (nao e encerrada)', async () => {
    const h = await createSession({ direction: 'outgoing', group: true })
    // O servidor respondeu com erro, mas alocou a midia (relay).
    await h.session.handleCallAck(ackWithError(true) as never)
    assert.equal(h.call.isEnded, false, 'a call NAO pode ser encerrada quando o ack traz relay')
})

test('ack com error e SEM relay: a call E encerrada (recusa de verdade)', async () => {
    const h = await createSession({ direction: 'outgoing', group: true })
    // Sem o relay: o servidor recusou mesmo.
    await h.session.handleCallAck(ackWithError(false) as never)
    // Sem relay, a recusa e' real: a call vai para o estado terminal (Ended).
    assert.equal(h.call.isEnded, true, 'sem relay a recusa e real e a call encerra')
})
