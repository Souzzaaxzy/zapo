---
'@zapo-js/voip': patch
---

Let a voice chat start in a group of any size.

A voice chat rings nobody, so its offer now ships no `<group_info>` roster and resolves no devices — the shape the official client emits, whose outbound offer takes the roster as optional and leaves it out for a group. The server fills the membership from its answer.

Naming members was what kept a voice chat out of a large group: the offer was refused with `error: '427'` past the 127-account roster bound and with `error: '404'` when the list was short. It also carries both spellings of its marker (`is_lightweight` and `lightweight`).

A call that rings is unchanged: it still names who it rings.
