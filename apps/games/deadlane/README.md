# DEADLANE

A 3D tower-defense skeleton for **Ship Shit Games** — you play the **Wardens**,
holding a single lane against the **Scourge** horde. Built with Vite + TypeScript
+ React UI overlays + Three.js, no external art (Three.js primitives only).

> Hold the line. Build towers. Stop the Scourge.

## Core loop

- An angled perspective camera looks down over a grid board with **one lane**
  from the Scourge spawn to your base.
- **Click an empty cell** to build a tower (costs gold). Towers can't sit on the
  lane or on each other.
- The Scourge spawns in **escalating waves** and walks the lane.
- Towers **auto-target the nearest in-range creep** and fire ember projectiles.
- **Killing a creep grants gold.** A creep that reaches the base costs **1 Base HP**.
- **Clear all waves to win.** Hit **0 Base HP** and the line is lost.

The HUD shows **Gold**, **Wave / Total**, **Base HP**, and a build hint with the
current tower cost.

### Visual language

Pure DOOM (see the studio `DESIGN.md`): void-black scene, gunmetal lane and
tower bodies, **hellfire** turret heads + projectiles, **blood-red** Scourge
creeps with a sickly toxic bio-glow, and a **bone/hellfire** base marker.

## Run it

```bash
npm install
npm run dev      # local dev server (http://localhost:5174)
npm run build    # static production build -> dist/
npm run preview  # serve the built dist/
```

> `build` is intentionally `vite build` only (no `tsc`) so a deploy never blocks
> on a type nit. Run `npx tsc --noEmit` yourself for a full typecheck.

## Deploy

This game is hosted behind the monorepo hub route. Its Vercel project should be
deployed by CLI from this monorepo, not Git-linked to a standalone game repo.
Use `bun run deploy:games:changed` at the repo root; docs-only edits skip game
deploys.

## Architecture

A thin `Game` class owns shared `GameState` and a few systems, driven by one
`requestAnimationFrame` loop with a **clamped delta**. Tunables live in a single
data-driven `CONSTANTS` object.

```
index.html            # React root
src/
  main.ts             # entry: mounts React shell, then Game on the canvas
  ui/AppShell.tsx     # shared UI package components + stable HUD element IDs
  game.ts             # Game class: owns state, runs the loop + wave director
  constants.ts        # CONSTANTS (board/economy/tower/creep/waves) + COLORS
  types.ts            # GameState + entity interfaces
  board.ts            # grid <-> world math, lane waypoints, path-cell set
  styles.css          # DOOM HUD styling
  systems/
    render.ts         # Three.js scene, camera, board art, hover highlight
    entities.ts       # towers / creeps / projectiles: spawn, target, move, combat
    input.ts          # pointer raycast -> grid cell, hover + click
    hud.ts            # imperative updates into the React-rendered HUD shell
```

### Tuning

Everything balance-related is in `src/constants.ts`: board size & lane shape,
starting gold / tower cost / rewards, base HP, tower range / fire rate / damage,
creep HP & speed and their per-wave growth, wave count / pacing, and camera.

## Lore

- **The Wardens** — engineers and gunners who hold the lanes with towers and attrition.
- **The Scourge** — the endless mutating horde that pours from the breaches.

This is a playable **skeleton**, not a finished game: one tower type, one creep
type, a fixed lane. The systems are structured so adding tower/creep types,
multiple lanes, or upgrades is mostly data + a new branch.
