# Deploying FPS Arena

Two pieces: the **game** (static Vite SPA hosted by the monorepo hub) and the
**PvP arena preview server** (PartyKit → Cloudflare edge). Single-player works
with just the front end; the arena preview needs the PartyKit server.

The PartyKit mode is an unauthenticated preview, not co-op and not a competitive
anti-cheat service. PvE waves are disabled. Clients propose movement and hit claims;
the server validates and owns accepted transforms, health, frag credit, and respawns.
Drop-in co-op Survivors remains tracked in
[#74](https://github.com/shipshitgames/deadrot.com/issues/74).

## 1. PvP arena preview server (PartyKit)

```bash
bun run party:deploy        # = partykit deploy  (first run prompts a login)
```

This deploys `party/arena.ts` and prints a host like:

```
scourge-survivors.<your-username>.partykit.dev
```

Copy that host — the front end needs it.

Local dev (run the game **and** the room server together — this is what makes
arena rooms work locally; `bun run dev` alone starts only the game):

```bash
bun run dev:all             # Vite (game) + PartyKit dev (rooms) together
# or run them in two terminals:
bun run party:dev           # ws server on http://127.0.0.1:1999
bun run dev                 # game on http://localhost:5178
```

In dev the client auto-targets `localhost:1999`. If the arena shows
"○ connecting…" forever, the room server isn't running — use `bun run dev:all`.

**Sharing a room:** joining sets the URL to `…/?room=CODE`. Send that link (or
use the **Copy room link** button on the pause screen) and your friend lands on
the join screen with the code prefilled.

## 2. Game front end (monorepo hub)

Set the PartyKit host as a build-time env var so the client knows where the rooms live:

```bash
# .env for the monorepo web build
VITE_PARTYKIT_HOST=scourge-survivors.<your-username>.partykit.dev
```

The game is served behind the monorepo hub route. Its Vercel project should be a
manual CLI deploy target from this monorepo, not Git-linked to the old standalone
game repo.

Deploy games from the repo root, and only when runtime code changed:

```bash
bun run deploy:games:changed -- --dry-run
bun run deploy:games:changed
```

Docs-only edits skip game deploys. A one-time local `vercel link` can point this
folder at the existing Vercel project; do not enable Git integration on the
Vercel project.

## Notes

- In **dev**, the client defaults `VITE_PARTYKIT_HOST` to `localhost:1999`, so
  `bun run party:dev` + `bun run dev` is all you need locally.
- If `VITE_PARTYKIT_HOST` is unset in production, single-player still works; the
  arena "Join Arena" button just won't be able to connect.
- The leaderboard is per-browser (`localStorage`). A global online leaderboard would
  reuse the same PartyKit backend (add a persistent "scores" room).
