---
'@zapo-js/voip': patch
---

Keep a voice chat from dropping the members who join it.

A group call placed `isLightweight` now carries that flag on its `CallInfo`, and the invisible sweep skips it. A voice chat announces `<silence>` and its members stay quiet until someone speaks, so a silent sender says nothing about them; reporting one invisible had the server expel a member who was simply not talking.
