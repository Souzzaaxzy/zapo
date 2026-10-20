---
'@zapo-js/voip': patch
---

Stop resolving devices for accounts a group offer cannot name.

A group of hundreds named more accounts than the roster bound allows, and every one of them had its devices resolved before the overflow was dropped. The bound is now applied first, so the fan-out lookup runs only for the accounts that fit.
