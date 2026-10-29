import assert from 'node:assert/strict'
import test from 'node:test'

import { computePhashV2 } from '../phash.js'

// Os valores esperados vem da implementacao de referencia do proprio `zapo-js`
// (`dist/message/crypto/phash.js`), conferida caso a caso antes deste teste existir: um
// hash que divergisse faria o servidor nao reconhecer o conjunto, e o offer seria recusado
// como um roster invalido -- sem pista nenhuma de que o defeito era o hash.

test('computePhashV2 hashes the canonical device set, bytewise sorted', () => {
    assert.equal(computePhashV2([]), '2:', 'lista vazia e o prefixo sozinho')
    assert.equal(computePhashV2(['111@lid']), '2:923RKGvk')
    assert.equal(computePhashV2(['111:3@lid']), '2:lMowXVI5')
    assert.equal(computePhashV2(['5511999999999@s.whatsapp.net']), '2:RJWVxcMQ')
})

test('computePhashV2 normalizes the jid before hashing', () => {
    // O mesmo device escrito com e sem o marcador de agente tem de dar o MESMO hash: o
    // marcador e reescrito, nunca duplicado.
    assert.equal(computePhashV2(['111.0:3@lid']), computePhashV2(['111:3@lid']))
    // `c.us` e o host legado do mesmo servidor.
    assert.equal(computePhashV2(['111@c.us']), computePhashV2(['111@s.whatsapp.net']))
})

test('computePhashV2 does not depend on the order the devices arrive in', () => {
    const a = computePhashV2(['5511999999999:2@s.whatsapp.net', '222@s.whatsapp.net'])
    const b = computePhashV2(['222@s.whatsapp.net', '5511999999999:2@s.whatsapp.net'])
    assert.equal(a, b)
})

test('computePhashV2 has no participant ceiling', () => {
    const many = Array.from({ length: 400 }, (_, i) => `200000000000${i}:1@lid`)
    const hash = computePhashV2(many)
    assert.match(hash, /^2:[A-Za-z0-9+/]{8}$/)
    // Um membro a mais muda o hash: ele cobre o conjunto inteiro.
    assert.notEqual(hash, computePhashV2([...many, '2999999999999:1@lid']))
})

test('computePhashV2 matches the reference implementation vectors', () => {
    // Vetores medidos contra a implementacao de referencia (`whatsapp-rust`,
    // `build_group_phash_set` + `participant_list_hash`): o conjunto e' o dos convidados
    // resolvidos (`A`) MAIS o device que envia (`B`) -- `phashV2([].concat(A, [B]))`. Os
    // dois valores abaixo sao os do teste dela; se o nosso hash divergir, o servidor nao
    // reconhece o conjunto e o offer e' recusado sem pista de que o defeito era o hash.
    const recipientes = [
        '100000000000001@lid',
        '100000000000001:5@lid',
        '100000000000002@lid',
        '100000000000003@lid',
        '100000000000003:12@lid',
        '100000000000099@lid'
    ]
    const proprioDevice = '100000000000099:24@lid'

    assert.equal(computePhashV2(recipientes), '2:rZoSAdIV', 'sem o proprio device')
    assert.equal(
        computePhashV2([...recipientes, proprioDevice]),
        '2:sti8OtHX',
        'com o proprio device (a forma que o servidor valida)'
    )
})
