# Starblight test harness

Starblight's browser harness lives in `e2e/starblight-headless.spec.ts` and runs
against the repository's shared Playwright configuration. From this package:

```sh
bun run test:e2e
```

From the repository root, the equivalent focused command is:

```sh
E2E_GAME_SLUGS=starblight bunx playwright test starblight-headless.spec.ts
```

The Vite development build installs `window.__starblight`. Production builds do
not expose it. The adapter returns serialized snapshots and bounded actions for
starting a run, advancing the real simulation at 60 Hz, spawning one fragile
target, forcing a level-up or boss encounter, selecting a draft card by id, and
setting boss health for HUD synchronization checks. HMR invalidates and removes
the adapter before disposing the game.

Tests synchronize through snapshots and HUD state. Do not add arbitrary sleeps;
use `advance()` for simulation progress and Playwright assertions for rendered
state.
