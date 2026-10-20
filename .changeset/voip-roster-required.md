---
'@zapo-js/voip': patch
---

Ship the roster on a voice chat offer again, capped at 127 accounts.

The roster is what the server fans the offer from: an offer that omits it is accepted and then creates nothing, so the card never appeared. What the server caps is its length — it refuses a longer one with `error: '427'`, which is what kept a group of 128 out, since the creator takes a slot.

So a voice chat names the accounts it can (up to 127) and starts; the rest of a larger group joins from the app. The marker still goes out under both spellings (`is_lightweight` and `lightweight`).
