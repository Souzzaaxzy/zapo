---
'@zapo-js/voip': minor
---

Start a group call as a voice chat with `startCall({ groupJid, participants, isLightweight: true })`.

A voice chat does not ring the group: the offer carries `lightweight='1'` and announces `<silence>` in place of media, as WhatsApp Web emits it. Measured against WhatsApp Web, a voice chat offer differs from a plain one by that attribute plus the `<silence>` node; everything else — routing, roster and child order — is unchanged.
