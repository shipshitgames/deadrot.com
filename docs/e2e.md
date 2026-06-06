# E2E Tests

Game E2E runs through Playwright. Use the Docker runner for local verification so
browser binaries, Linux packages, and dependency installs stay inside the image.

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
cd apps/games/scourge-survivors && bun run test:e2e -- --ui
cd apps/games/scourge-survivors && bunx playwright show-report
```

CI runs the Dockerized suite on pull requests, pushes to `main` or `master`,
manual dispatch, and a weekly schedule. The workflow uploads `.artifacts/e2e` so
failed runs retain Playwright reports and traces.
