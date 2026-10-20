---
'@zapo-js/voip': patch
---

Log an offer ack that matches no live call.

An ack that arrives for a call the manager cannot match was dropped in silence, which reads exactly like an ack that never arrived — the two need telling apart when a group call goes quiet. It is logged at warn now, with the call id, the sender, the ack type, its error and how many calls are live.
