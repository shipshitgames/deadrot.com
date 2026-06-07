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

CI runs cross-game E2E on pull requests, pushes to `develop`, `staging`, `main`,
or `master`, manual dispatch, and a weekly schedule. The workflow uploads
Playwright reports, screenshots, videos, and traces from `playwright-report/`,
`test-results/`, and the Docker runner's `.artifacts/e2e/` directory.
