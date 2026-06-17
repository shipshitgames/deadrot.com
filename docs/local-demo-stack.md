# Local Deadrot Demo Stack

The local demo stack is the "show me the universe" path for contributors and
agents. It starts the hub, API, Warline, and a safe selected set of games with
one command:

```bash
bun run demo:dev
```

Default URLs:

| Surface | URL |
| --- | --- |
| Web hub | `http://127.0.0.1:3000` |
| API live health | `http://127.0.0.1:3004/health/live` |
| API ready/degraded health | `http://127.0.0.1:3004/health/ready` |
| Warline | `http://127.0.0.1:5180` |
| Scourge Survivors | `http://127.0.0.1:5178` |
| Deadlane | `http://127.0.0.1:5174` |

Verify the stack from another terminal:

```bash
bun run demo:smoke
```

`/health/ready` is allowed to report `DEGRADED` when `DATABASE_URL` is unset.
That is the intended offline fallback: the API is alive, and the missing DB is
reported explicitly instead of blocking the demo.

## Selecting Games

The default game set is:

```txt
warline,scourge-survivors,deadlane
```

Run a custom set:

```bash
DEMO_GAME_SLUGS=warline,brawl,redline bun run demo:dev
```

Run every shipped game:

```bash
DEMO_GAME_SLUGS=all bun run demo:dev
```

## Environment

No secrets are required. Copy examples only when you need local overrides:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Useful local overrides:

- `DEADROT_DEMO_WEB_PORT=3000`
- `DEADROT_DEMO_API_PORT=3004`
- `DEMO_GAME_SLUGS=warline,scourge-survivors,deadlane`
- `DATABASE_URL=` empty means API ready health is degraded but clear.
- `VITE_WARLINE_HOST=` empty keeps Warline in local/offline mode when the socket
  server is not running.
- `VITE_PARTYKIT_HOST=` empty keeps Scourge Survivors multiplayer optional.

## What This Is Not

The demo stack does not deploy production, run paid access flows, start external
providers, call asset generation services, or require Docker. Docker Compose is
not used because the current safe local stack has no required containerized
service; the API degrades cleanly without a database unless you intentionally
provide one.

For daily focused development, start only the app you are editing:

```bash
bun run --cwd apps/web dev
bun run --cwd apps/games/scourge-survivors dev
```

Use `bun run demo:dev` when you need the broader contributor/demo view.
