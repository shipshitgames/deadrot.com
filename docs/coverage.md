# Coverage

A line + function coverage baseline guards the pure-logic runtime packages so
their core simulation/data code can't silently lose test coverage. The gate runs
under `bun test --coverage` and is wired into CI as a non-blocking job.

## Enforced scope

Three dependency-light, deterministic packages are in the gate. They are pure
logic (no DOM, canvas, WebAudio, or network), so they are cheap to test
thoroughly and worth holding to a high bar:

| Package | What it is |
| --- | --- |
| `@deadrot/catalog` | The single source of truth for the game roster + derived maps. |
| `@deadrot/game-kit` | Shared headless game logic: RNG, fixed loop, pools, maps, modes, telemetry, codex, war record. |
| `@shipshitgames/warline` | The deterministic war-state machine: reducers, operations, events, summaries. |

Each must stay at **≥80% line and function coverage**. Browser/IO surfaces
(audio, juice/VFX, the partysocket client, the browser telemetry shim) are
deliberately **excluded** — they have no headless unit surface — so the gate
measures the logic that unit tests can actually exercise.

## Run it locally

The repo-level gate (the enforced scope only):

```bash
bun run test:coverage
```

Every package that defines `test:coverage` (a superset, includes ones not yet
gated):

```bash
bun run test:coverage:all
```

A single package:

```bash
bun --cwd packages/warline run test:coverage
```

Each run prints a per-file table and writes `lcov.info` + a text report under
that package's `coverage/` directory (gitignored). Open the LCOV in any viewer
for line-level detail.

## How the threshold works

Coverage is configured per package in `bunfig.toml`:

```toml
[test]
coverage = true
coverageReporter = ["text", "lcov"]
coverageThreshold = 0.8
coverageSkipTestFiles = true
# Per-package and optional — omit it for a pure-data package like @deadrot/catalog.
coveragePathIgnorePatterns = ["**/client.ts"]
```

Notes specific to `bun test`:

- **`coverageThreshold` is enforced per file.** A single file dropping below
  0.8 fails the whole run (non-zero exit), even if the package average is far
  higher. This is intentional: it stops a well-covered package from hiding one
  untested module.
- **There is no branch metric** — bun reports function and line coverage only.
  The gate holds both to 0.8.
- **`coverageSkipTestFiles`** keeps `*.test.ts` files out of the denominator.
- **Only files a test loads are measured.** bun instruments code reached during
  the run, so a module that no test imports (directly or transitively) is absent
  from the report — it contributes nothing and cannot trip the per-file gate. The
  baseline therefore covers *the pure-logic surface the tests exercise*, not every
  file on disk. When you add a pure module, add at least one test that imports it,
  or it silently escapes the gate.
- **`coveragePathIgnorePatterns`** scopes the measurement to a package's own
  pure-logic source. It is how `@deadrot/game-kit` excludes the workspace
  *source* dependencies (`warline/src`, `assets/src`) that get instrumented
  transitively but are tested by their own suites, plus its specific WebAudio/DOM
  files (`audio/AudioEngine.ts`, `audio/bindSettings.ts`, `juice/**`,
  `telemetry/browser.ts`) — file-scoped, so the pure `audio/sfxPalette.ts` stays
  gated; and how `@shipshitgames/warline` excludes the browser `client.ts`.

## CI

The `Coverage` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs `bun run test:coverage` on every PR and uploads the per-package reports as
the `coverage-reports` artifact. It goes red when coverage drops below baseline.

It is **not** one of the two required status checks yet (those are kept fast on
purpose). Promoting the gate to a required check is tracked separately. Until
then, treat a red `Coverage` job as a real failure to fix, not noise.

## Adding a package to the gate

1. Add `test`, `test:unit`, and `test:coverage` (`bun test ...`) scripts to the
   package, plus a `bunfig.toml` with the `[test]` block above. Use
   `coveragePathIgnorePatterns` to drop any non-headless modules.
2. Get the package's own source to ≥80% line + function coverage.
3. Add a `--filter=<package>` to the root `test:coverage` script in
   [`package.json`](../package.json).
