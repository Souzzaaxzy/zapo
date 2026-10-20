---
'@zapo-js/voip': patch
---

Cap a group offer at the server's call ceiling, not the wire bound.

A group `<group_info>` may serialize up to 127 entries, but the server refuses an offer that names more than the call may hold: the `group_call_max_participants` AB prop, 32 by default. Measured: 32 is accepted, 127 is refused with `error: '427'`/`'412'`. The official client applies the same gate before placing a group call. The roster is capped at 32, so a larger group still starts and the rest joins from the app.
