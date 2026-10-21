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
export declare function computePhashV2(participants: readonly string[]): string;
