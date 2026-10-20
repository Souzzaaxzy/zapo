# @zapo-js/voip (fork)

Standalone build of the `@zapo-js/voip` package from
[`Souzzaaxzy/zapo`](https://github.com/Souzzaaxzy/zapo) (`master`, `packages/voip`),
published on this branch so it can be consumed as a plain git dependency.

Why a branch: `npm install` cannot take a package that lives in a subdirectory of a
monorepo. The bot installs with `npm install` first, so the package has to sit at the
repository root — exactly how `Souzzaaxzy/lizzy-call` does it.

`dist/` is committed because a git dependency has no build step.

## What it adds over the upstream release

- `startCall({ groupJid, participants, isLightweight: true })` places a group **voice
  chat**: the offer carries `lightweight='1'` and announces `<silence>` instead of media,
  so the group is not rung.
- A voice chat is exempt from the invisible sweep: its members stay quiet until they
  speak, so silence must not be reported as `invisible` (which had the server expel a
  member who was simply not talking).

## Rebuilding

```sh
npm install
npm run build      # tsc (cjs + esm) into dist/
npm test
```

Sync `src/` from `packages/voip/src` of the fork's `master` when it moves.
