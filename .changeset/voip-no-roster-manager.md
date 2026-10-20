---
'@zapo-js/voip': patch
---

Place a voice chat whose group does not fit, without a roster.

The offer for such a group ships no `<group_info>` (nobody to name), but the manager still demanded a peer to address and threw "needs the participants to ring" — the command failed with "the media engine did not start" instead of placing the call. The call itself is the target now, as a group accept uses. A call that rings still requires someone to ring.
