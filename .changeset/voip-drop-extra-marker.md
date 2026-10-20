---
'@zapo-js/voip': patch
---

Drop the extra marker attribute from a voice chat offer.

A voice chat offer carries exactly two things: the `lightweight='1'` marker and the `<silence>` node. The extra `is_lightweight` attribute added alongside it is not one the server knows, and an unknown attribute makes it drop the offer — the call was accepted and then never appeared, in any group. Back to the shape that places a voice chat, keeping only the roster cap.
