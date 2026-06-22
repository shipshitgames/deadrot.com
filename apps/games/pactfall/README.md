# PACTFALL

A **Pyre-vs-Wardens MOBA thin-slice** for **Ship Shit Games** — a single playable lane,
one champion, and a base to topple. DOOM-grade visual identity: blood, hellfire, gunmetal,
and a pulsing toxic-green Scourge blob at the heart of the lane.

> This is a **playable core loop**, not a full game. It builds clean as a static Vite app.

## The loop

- You control the **Pyre champion** (a bone/blood capsule with a hellfire crest) marching the lane.
- An enemy **Warden champion** (cold gunmetal, blood-hot crest) pushes the other way — it chases
  your units and sieges your base. Slain champions go down and **redeploy after a short delay**, so
  dying costs you tempo.
- **Auto-attack** fires at the nearest enemy in range — a brief beam on a short cooldown.
  Target priority: enemy units → the Scourge blob → the enemy base once you push to it.
- A **steady trickle of minions** spawns from each base and advances down the lane (staggered, so the
  front line actually moves). Yours are hellfire-tinted; the Wardens' are gunmetal. Minions siege and
  chip whichever base they reach.
- A neutral **Scourge blob** pulses at center. Kill it for a **temporary damage buff** (it respawns).
- A **tower line gates each base.** Two towers per side stand on the live lane between center and the
  base they shield. A base **cannot be damaged while any of its towers still stand** — towers take
  priority over the base for champions, minions, and auto-attack alike, and a standing tower **shoots
  back** at anything that dives it. Topple a side's whole line and its base is exposed (the HUD tower
  readout flips to **OPEN**).
- **Raze the Warden tower line, then destroy the base to WIN.** If your Pyre base falls, you **LOSE**.

## Controls

| Input | Action |
| --- | --- |
| Arrows | Move the champion |
| Click / tap ground | Click-to-move (also works on touch) |
| `Q` / tap HUD box | Cinder Lance — line nuke toward the cursor (or lane facing) |
| `W` / tap HUD box | Pact Brand — slowing ground zone at the cursor (or your feet) |
| `E` / tap HUD box | Vault — short dash along your move direction |
| (auto) | Auto-attack nearest enemy in range |
| `R` / click | Redeploy after a win or loss |
| `Esc` | Pause |

## Run it

```bash
npm install
npm run dev      # local dev server (Vite)
npm run build    # static build -> dist/
npm run preview  # preview the production build
```

> Build is intentionally `vite build` only (no `tsc`) so a stray type nit never blocks a deploy.

## Deploy

This game is hosted behind the monorepo hub route. Its Vercel project should be
deployed by CLI from this monorepo, not Git-linked to a standalone game repo.
Use `bun run deploy:games:changed` at the repo root; docs-only edits skip game
deploys.

## Stack

- [Vite](https://vitejs.dev/) `^5.4` + [TypeScript](https://www.typescriptlang.org/) `^5.6`
- [Three.js](https://threejs.org/) `^0.169` — all visuals are engine **primitives** with emissive
  materials in the studio palette. No external art.
- React UI shell via `@shipshitgames/ui`; gameplay still runs in the Three.js loop.

## Architecture

A thin `Game` class owns shared state and four systems, driven by a single
`requestAnimationFrame` loop with a **clamped delta**:

```
src/
  main.ts                  # entry: mounts React shell, wires canvas + HUD, starts the loop
  ui/AppShell.tsx          # shared UI package components + stable HUD element IDs
  styles.css               # HUD styling over the canvas
  game/
    Game.ts                # thin owner of state + the rAF loop
    constants.ts           # CONSTANTS + COLORS (all tunables)
    map.ts                 # data-driven lane/tower/base/objective model (ASHGATE_MAP)
    types.ts               # Entity / Phase types
    factory.ts             # primitive meshes for each entity
    systems/
      RenderSystem.ts      # renderer, scene, lights, arena, follow-cam
      InputSystem.ts       # arrows + click/tap move intent, latched Q/W/E ability presses
      EntitySystem.ts      # spawns, movement, targeting, combat (the loop)
      abilities.ts         # Q/W/E casts: cooldown/mana gates, skillshots, brand zones
      HudSystem.ts         # reads state, updates the React-rendered HUD shell
```

Tunables (HP, speeds, ranges, cooldowns, spawn cadence, buff duration) all live in
`src/game/constants.ts`.

## Map & lanes

The arena is described **as data** in `src/game/map.ts` (`ASHGATE_MAP`) — the sim builds
itself from that model rather than hard-coding positions:

- The model already names **all three canonical lanes** (`top`, `mid`, `bot`), each with its own
  lateral offset and a full, symmetric tower line for both teams. Only **mid is `active`** in this
  slice; `top`/`bot` are fully described but dormant.
- Nothing in the sim hard-codes "one lane". `EntitySystem` builds towers, spawns minions, and the
  HUD tallies structures by iterating `activeLanes(map)` — flipping a lane's `active` flag is all it
  takes to light it up.
- Every derived position is computed from the data: a tower's Z **lerps** from its owner's base toward
  the enemy base by its `t` fraction (outer → inner), and bases sit at the canonical lane ends.
- `objectives` enumerate the win/lose conditions (destroy enemy base, defend base) plus the optional
  Scourge, each flagged `decisive` or not.

### Three-lane expansion

This slice ships **single-lane** by design (Scope) — but the data model is shaped so the full
three-lane MOBA is a content change, not a rewrite. Activating `top`/`bot` (and the wave/AI tuning
that a three-lane push needs) is tracked in follow-up issues
[#206](https://github.com/shipshitgames/deadrot.com/issues/206),
[#209](https://github.com/shipshitgames/deadrot.com/issues/209),
[#213](https://github.com/shipshitgames/deadrot.com/issues/213),
[#214](https://github.com/shipshitgames/deadrot.com/issues/214), and
[#215](https://github.com/shipshitgames/deadrot.com/issues/215).

## Universe

The **Pyre** (offense) lights the lane; the **Wardens** (defense) hold the line. The neutral
**Scourge** — a zerg-like horde — festers at center, a prize for whoever dares carve through it.
