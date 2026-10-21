---
'@zapo-js/voip': minor
---

A group voice chat whose roster does not fit the call ceiling now ships the participant set as
a hash (`<group_info phash="2:...">`, no children) instead of omitting the roster. Measured on a
live group: naming nobody is dropped in silence, naming 32 is refused with `412` and naming 127
with `427`, so no enumeration cap can satisfy a bigger group. The hash is the same
`computePhashV2` group messages use, ported into the plugin.
