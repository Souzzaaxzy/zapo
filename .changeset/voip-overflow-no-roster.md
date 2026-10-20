---
'@zapo-js/voip': patch
---

Ship no roster for a voice chat whose group does not fit the call ceiling.

A group larger than the call ceiling (32) cannot be named whole, and the server refuses an offer that names more. A voice chat rings nobody, so there is nobody to name: it now goes without a `<group_info>` and lets the server fill the membership from its answer. A voice chat that fits still names who it addresses, and a call that rings is unchanged.

The offer log now names the accounts it actually named, at warn level, so the roster size is visible next to the group size.
