# DEADROT (`shipshitgames/deadrotcom`)

The shipped **DEADROT** monorepo: the web hub, lore app, games, and runtime
packages used by those games. **Turborepo + Bun.**

Studio tooling for generating/building assets lives in the sibling
[shipshitgames/shipshitgames](https://github.com/shipshitgames/shipshitgames)
repo; generated game assets ship from this repo.

> *We lost the sky. Now we burn it back.*

## Apps
- **`apps/web`** — the **hub**: universe front (gallery, bestiary, characters, factions,
  universe, docs) + the game loader. `next.config.mjs` proxies `/<game>/` to each game's deploy,
  so players load any game from one front door. → deadrot.com
- **`apps/lore`** — lore/canon app.
- **`apps/games/*`** — shipped Deadrot games.

## Packages
- **`packages/assets`** — `@shipshitgames/assets`: shared asset catalog, runtime game packs, and source/history archive.
- **`packages/engine`** — `@shipshitgames/engine`: shared runtime engine primitives.
- **`packages/ui`** — `@shipshitgames/ui`: shared React game UI primitives.
- **`packages/warline`** — `@shipshitgames/warline`: multiplayer/networking helpers.

## Develop
```bash
bun install
bun run dev        # hub on next dev
bun run build
bun run typecheck
```

## Deploy Games

Game apps live on `master` under `apps/games/*`. Their Vercel projects should
not be Git-linked to old standalone game repos; deploy them from this monorepo
with the Vercel CLI.

Only deploy a game when runtime code for that game changed:

```bash
bun run deploy:games:changed -- --dry-run
bun run deploy:games:changed
```

The deploy script checks changed runtime files under `apps/games/<slug>/` plus
shared runtime packages. Docs-only edits do not trigger a game deploy.
