# Playable Proof Tours

Playable proof tours are the demo/shippability layer for the Deadrot games. The
root Playwright E2E suite still owns assertions; proof tours answer a different
question: can an agent or maintainer boot the game, drive one stable interaction,
and inspect screenshots that show the build is alive?

```bash
bun run proof:tours
```

The command starts each shipped game from `@deadrot/catalog`, drives a
deterministic recipe, captures three screenshots per game, probes the canvas (or
page, for Warline) for nonblank pixels, and writes:

```txt
.artifacts/proof-tours/report.md
.artifacts/proof-tours/report.json
.artifacts/proof-tours/<game>/*.png
```

To run only selected games:

```bash
PROOF_GAME_SLUGS=scourge-survivors,warline bun run proof:tours
```

If the default game ports are busy, shift the whole catalog range:

```bash
PROOF_PORT_BASE=5274 bun run proof:tours
```

If matching dev servers are already running and you want to reuse them:

```bash
PROOF_REUSE_SERVERS=1 bun run proof:tours
```

The current runner uses Playwright directly because `@shipshitgames/game-tester`
is not yet a dependency of this repo. The report contract intentionally mirrors
the expected game-tester shape: ready state, page errors, console errors,
nonblank result, and screenshot artifact paths.

## Recipes

- `scourge-survivors`: opens Scourge Labs, expands runtime assets, spawns foes.
- `deadlane`: reveals the title menu and deploys the lane-defense run.
- `pactfall`: clicks into the lane and fires an ability input.
- `brawl`: starts a duel and sends a special command.
- `starblight`: reveals the menu and engages the orbital run.
- `redline`: ignites the courier run, accelerates, and jumps.
- `rothulk`: starts a breach run.
- `warline`: opens the Command Table and captures the Front.

Use proof tours for visual/demo evidence and `bun run e2e` for regression
coverage. A PR that changes game boot, canvas rendering, shared UI, or catalog
routing should keep both green.
