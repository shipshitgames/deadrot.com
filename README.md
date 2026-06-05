# DEADROT (`shipshitgames/deadrotcom`)

The player-facing side of the **DEADROT** universe — the game **hub** at
[deadrot.com](https://deadrot.com). **Turborepo + Bun.** Canon lives in
[shipshitgames/lore](https://github.com/shipshitgames/lore); the studio + lessons site lives in
[shipshitgames/shipshitgames](https://github.com/shipshitgames/shipshitgames).

> *We lost the sky. Now we burn it back.*

## Apps
- **`apps/web`** — the **hub**: universe front (gallery, bestiary, characters, factions,
  universe, docs) + the game loader. `next.config.mjs` proxies `/<game>/` to each game's deploy,
  so players load any game from one front door. → deadrot.com

Games move into `apps/*` here as they are consolidated.

## Packages
- **`packages/ui`** — `@shipshitgames/ui`: shared React + Tailwind + shadcn components.

## Develop
```bash
bun install
bun run dev        # hub on next dev
bun run build
bun run typecheck
```
