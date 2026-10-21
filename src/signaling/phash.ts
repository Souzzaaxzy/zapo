import { sha256 } from 'zapo-js/crypto'
import { bytesToBase64, TEXT_ENCODER } from 'zapo-js/util'

/** Leading digest bytes retained before base64: six encode to exactly eight chars, no padding. */
const PHASH_DIGEST_PREFIX = 6

/** The host the legacy `c.us` placeholder stands for on the wire. */
const HOST_DOMAIN = 's.whatsapp.net'

/**
 * Computes the v2 participant hash (`2:<base64>`) that references a participant set too
 * large to enumerate.
 *
 * <p>A group whose members resolve to more devices than the `<group_info>` wire bound
 * cannot be named: the server refuses a roster that does not describe the whole group
 * (`412`/`427`), and it drops an offer that names nobody (no answer at all). The official
 * client references such a set by its hash instead, carrying `<group_info phash="...">`
 * with no `<user>` children; the server resolves the hash against the group.
 *
 * <p>The hash is the same one group messages attach as `phash`: every device jid is
 * canonicalized to `<user>.0:<device>@<server>` (with `c.us` rewritten to the real host),
 * the set is sorted bytewise, hashed as a single SHA-256 stream, and the first six digest
 * bytes are base64-encoded behind the `2:` version prefix. There is no participant
 * ceiling: the canonical buffer grows to fit the list.
 *
 * @param participants device jids, in any order
 * @returns the `2:`-prefixed phash, or `'2:'` when the list is empty
 */
export function computePhashV2(participants: readonly string[]): string {
    if (participants.length === 0) return '2:'
    const canonical = participants.map(canonicalizeJid).sort(compareBytes)
    const digest = sha256(canonical.map((jid) => TEXT_ENCODER.encode(jid)))
    return `2:${bytesToBase64(digest.subarray(0, PHASH_DIGEST_PREFIX))}`
}

/**
 * Rewrites one jid to the canonical `<user>.0:<device>@<server>` the hash is taken over.
 *
 * <p>An agent marker already present is dropped and re-added, so `.0` is never doubled; a
 * jid with no device segment gets `.0:`; the legacy `c.us` server is replaced by the real
 * host, exactly as the reference implementation does.
 */
function canonicalizeJid(jid: string): string {
    const at = jid.indexOf('@')
    if (at < 1 || at === jid.length - 1) return jid

    const colon = jid.indexOf(':')
    const userEnd = colon >= 0 && colon < at ? colon : at
    const hasAgentMarker = userEnd >= 2 && jid[userEnd - 2] === '.' && jid[userEnd - 1] === '0'
    const user = jid.slice(0, hasAgentMarker ? userEnd - 2 : userEnd)

    const device = colon >= 0 && colon < at ? digitsOnly(jid.slice(colon + 1, at)) : 0
    const server = jid.slice(at + 1)
    const host = server === 'c.us' ? HOST_DOMAIN : server

    return `${user}.0:${device}@${host}`
}

/** A device segment that is not all digits is not a device; the reference falls back to 0. */
function digitsOnly(value: string): number {
    if (value.length === 0 || !/^\d+$/.test(value)) return 0
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : 0
}

/** Bytewise ordering of the canonical jids: length breaks a shared prefix, as on the wire. */
function compareBytes(a: string, b: string): number {
    const length = Math.min(a.length, b.length)
    for (let i = 0; i < length; i += 1) {
        const diff = a.charCodeAt(i) - b.charCodeAt(i)
        if (diff !== 0) return diff
    }
    return a.length - b.length
}
