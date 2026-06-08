# ROTHULK

A side-scrolling **platformer** for [Ship Shit Games](https://github.com/) — infiltrate a
rotting, living **Scourge** bio-ship, stomp the parasitic horde, and ignite the breach-core
at the heart of the hulk. A playable core loop skeleton, not a finished game.

> **THE PYRE // INFILTRATION.** Run the hulk. Pop the Scourge. Burn it from the inside.

## The loop

- **Run + variable-height jump** across iron slabs bolted over fleshy Scourge walls.
- Tight feel: **coyote time** + **jump buffering**, snappy fall gravity, short-hop on release.
- **Stomp** Scourge blobs from above to pop them and **bounce**; touch one from the side and
  you take damage.
- **Dodge hazards** — acid pools (toxic-green) and bone spikes.
- **Ride moving platforms** across the chasms.
- Grab **embers** for score; bank a **mid-level checkpoint**.
- A fall into the void or losing all HP costs a **life**.
- Reach the pulsing **breach-core** to ignite it, sever the local Choir node, and turn the
  remaining Scourge feral.
- Escape back to the armed boarding spike to clear the hulk.

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` or `A` `D` |
| Jump (hold = higher) | `Space`, `W`, or `↑` |
| Stomp | jump onto a Scourge from above |
| Restart | `R` |

## Run it

```bash
npm install
npm run dev      # local dev server (Vite)
npm run build    # static build -> dist/
npm run preview  # serve the built dist/
```

## Deploy

This game is hosted behind the monorepo hub route. Its Vercel project should be
deployed by CLI from this monorepo, not Git-linked to a standalone game repo.
Use `bun run deploy:games:changed` at the repo root; docs-only edits skip game
deploys.
`build` is intentionally `vite build` only (no `tsc`) so a stray type nit never
blocks a deploy.

## Stack

- [Vite](https://vitejs.dev/) `^5.4` + TypeScript `^5.6`
- [Three.js](https://threejs.org/) `^0.169` — **primitives only**, orthographic side camera
- React UI shell via `@shipshitgames/ui`; gameplay still runs in the Three.js loop.

## Architecture

A thin `Game` class owns shared state and drives the systems from one `requestAnimationFrame`
loop with a **clamped delta**. Tunables live in a single data-driven `CONSTANTS` object.

```
src/
  main.ts            mounts React shell, then bootstraps title-screen wiring
  ui/AppShell.tsx    shared UI package components + stable HUD element IDs
  constants.ts       COLORS (DOOM palette) + CONSTANTS (all tunables)
  styles.css         DOOM HUD overlay (pixel type, uppercase, blood-on-gunmetal)
  game/
    Game.ts          owner: state + loop + gameplay step
    coreLoop.ts      pure state helpers for core ignition, escape, and progress
    types.ts         entity / level contracts
    level.ts         the hand-authored hulk level (data)
    input.ts         keyboard, edge-detected jump
    physics.ts       AABB sweep-and-resolve collision
    render.ts        Three.js scene, ortho camera, primitive meshes, juice
    hud.ts           imperative adapter over the React-rendered HUD shell
```

## Aesthetic

DOOM: void `#0a0a0a`, blood `#c1121f`, hellfire `#ff6a00`, gunmetal `#34343c`, bone `#e9e3d6`
text. **Toxic-green `#8bdc1f` is reserved for the Scourge** (acid, bio-nodes, the core).
Heavy uppercase HUD; hard edges; ember glow used sparingly.

## Universe

Enemy: the **Scourge**, a zerg-like parasitic horde that wears its hosts. Factions: the
**Pyre** (offense — you) and the **Wardens** (defense). Flavor is light; gameplay first.
