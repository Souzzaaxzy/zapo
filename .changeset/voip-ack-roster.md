---
'@zapo-js/voip': patch
---

Seed a group call's composition from the roster the offer ack carries.

A voice chat whose group does not fit ships no `<group_info>` on its offer, and the manager never read the roster the server answered with — so the composition stayed empty and the call never came up. The ack of a group offer now seeds it, the same path the offer used, which is the only roster such a call gets.
