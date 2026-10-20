---
'@zapo-js/voip': patch
---

Answer a stale-roster nack (`427`) by offering again with the roster it echoed.

The server refuses an offer whose device set it considers stale and answers with the set it wants, expecting the caller to offer again against it. A voice chat on a large group was ending there; now the first `427` re-sends the offer with the echoed roster, capped at the placement bound as always. A second refusal, or any other error, still ends the call, so there is no retry loop.
