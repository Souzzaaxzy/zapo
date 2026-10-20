---
'@zapo-js/voip': patch
---

Start a voice chat in a group of any size.

A voice chat rings nobody, so its offer no longer names the whole group: it lists only the caller and the server fills the roster from its answer. Naming every member was useless for a call that does not ring and pushed the offer past the platform's ring limit, which is what kept a voice chat from starting in a group with more than a couple of dozen members - the case the feature exists for.
