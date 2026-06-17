# E2E Tests

Game E2E runs through the root Playwright suite. Use the Docker runner for full
local verification so browser binaries, Linux packages, and dependency installs
stay inside the image.

```bash
bun run e2e:docker
```

The Docker runner builds `deadrotcom-e2e:local`, installs Bun dependencies and
the matching Playwright Chromium revision inside the image, and writes
Playwright reports, screenshots, traces, and videos to:

```txt
.artifacts/e2e/
```

Direct host runs are still available when you intentionally want to use your
local environment:

```bash
bun run e2e
bun run e2e:ui
bun run e2e:report
```

To focus on one or more games locally or in CI, pass a comma-separated slug
allow-list:

```bash
E2E_GAME_SLUGS=scourge-survivors,warline bun run e2e
```

The suite starts its own Vite servers by default so local runs cannot silently
reuse a stale checkout. If the default ports `5174` through `5180` are busy,
shift the whole range:

```bash
E2E_PORT_BASE=5274 bun run e2e
```

Only opt into server reuse when you intentionally started matching game dev
servers yourself:

```bash
E2E_REUSE_SERVERS=1 bun run e2e
```

CI runs cross-game E2E on pull requests, pushes to `master`, manual dispatch,
and a weekly schedule. Docs-only commits (`**/*.md`, `docs/**`, `.agents/**`,
`.claude/**`, `skills/**`) are skipped, and superseded runs on the same ref are
cancelled.

`scripts/changed-e2e-games.mjs` detects which games a change can affect (the
full set on push to a release branch's first commit, manual dispatch, or the
weekly cron) and emits them as a JSON array. The `Playwright (<game>:<view>)`
job fans that array onto one runner per affected game × viewport via a matrix —
both `desktop` and `mobile` run per game, not a single `<game>` axis — caching
the Bun install and Playwright browser downloads. The `Dockerized game E2E` job
runs only on non-pull-request events — it keeps the pinned local-repro image
(`bun run e2e:docker`) green using a buildx GHA layer cache. The workflow
uploads Playwright reports, screenshots, videos, and traces from
`playwright-report/`, `test-results/`, and the Docker runner's `.artifacts/e2e/`
directory.

## Deep per-game specs

Every shipped game has the shared boot smoke in `e2e/games.spec.ts` (boot +
core-control check, driven from the `gameSpecs` table) **plus** a dedicated
deep-gameplay spec in `e2e/`. Each deep spec is guarded by
`test.skip(!testInfo.project.name.startsWith("<game>:"), …)` so it only runs
under that game's own `<game>:desktop` / `<game>:mobile` projects (and their
isolated dev server + port).

To add a game:

1. Add its `gameSpecs` entry in `e2e/games.spec.ts` (the shared boot smoke).
2. Add a deep spec in `e2e/`, guarded by `startsWith("<game>:")`, and register
   it in `playwright.config.ts` `testMatch`.

The invariant — catalog ↔ filesystem parity, one deep spec per slug, and a
complete `<slug> × {desktop, mobile}` project matrix — is enforced at unit speed
by `e2e/coverage.test.ts` (`bun run test:e2e:unit`).

The deep spec files:

- `e2e/rothulk-platforming.spec.ts` — rothulk
- `e2e/pactfall-moba.spec.ts` — pactfall
- `e2e/brawl-arena.spec.ts` — brawl
- `e2e/scourge-survivors-sandbox.spec.ts` — scourge-survivors
- `e2e/redline-courier.spec.ts` — redline
- `e2e/starblight-drydock.spec.ts` — starblight
- `e2e/deadlane-defense.spec.ts` — deadlane
- `e2e/warline-front.spec.ts` — warline

`e2e/warline-reporting.spec.ts` and `e2e/warline-war-effort.spec.ts` are
supporting slices driven through other games' debug handles, not the per-game
owners.
