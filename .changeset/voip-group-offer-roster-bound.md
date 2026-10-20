---
'@zapo-js/voip': patch
---

Stop a group offer from naming more accounts than the server accepts.

A group `<offer>`'s `<group_info>` is now capped at 127 accounts, the roster bound the official client enforces. The server refuses an offer that names more with `error: '427'` on the `<ack>`, which the manager turns into `SetupFailed`; a group of 128 members overflows the bound by one, because the creator counts. This is not the 32-participant limit of a *connected* call: a group call, voice chat included, may name up to 127 and connect 32.
