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
- **Push to the Warden base and destroy it to WIN.** If your Pyre base falls, you **LOSE**.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / Arrows | Move the champion |
| Click / tap ground | Click-to-move (also works on touch) |
| (auto) | Auto-attack nearest enemy in range |
| `R` / click | Redeploy after a win or loss |

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
    types.ts               # Entity / Phase types
    factory.ts             # primitive meshes for each entity
    systems/
      RenderSystem.ts      # renderer, scene, lights, arena, follow-cam
      InputSystem.ts       # WASD + click-to-move intent
      EntitySystem.ts      # spawns, movement, targeting, combat (the loop)
      HudSystem.ts         # reads state, updates the React-rendered HUD shell
```

Tunables (HP, speeds, ranges, cooldowns, spawn cadence, buff duration) all live in
`src/game/constants.ts`.

## Universe

The **Pyre** (offense) lights the lane; the **Wardens** (defense) hold the line. The neutral
**Scourge** — a zerg-like horde — festers at center, a prize for whoever dares carve through it.
