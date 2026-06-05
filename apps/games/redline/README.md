# REDLINE

A high-speed **Pyre courier runner** for the **Ship Shit Games** universe — Sonic-like
auto-momentum side-scrolling against the clock. Build speed, jump the Scourge creep,
roll under the arches, ride the embers, and slam the **BEACON** at the lane's end before
the timer beats you. Your best time is kept in `localStorage`.

> Built with Vite + TypeScript + React UI overlays + Three.js primitives. Every
> mesh is a box, capsule, cone, or octahedron lit by hellfire.

## Play

```bash
npm install
npm run dev      # http://localhost:5176
```

### Controls

| Action            | Keys                          |
| ----------------- | ----------------------------- |
| Accelerate (hold) | `→` / `D` (or hold a touch)   |
| Jump (variable)   | `Space` / `↑` / `W`           |
| Dash-roll         | `Shift` / `↓` / `S`           |
| Restart           | `R`                           |

On touch: hold anywhere to accelerate, tap the **upper** screen to jump, hold the
**lower** screen to roll.

## The core loop

1. **Auto-momentum** — you always run forward. Holding accelerate ramps you from a creep
   speed up to a high top speed; let go and you coast back down.
2. **Jump** — a satisfying, variable-height arc (hold for higher, tap for short hops),
   with coyote-time and jump-buffering so it feels responsive. Clear pits and the tall
   blood-red **creep spikes**.
3. **Dash-roll** — a low, fast roll that ducks you under the low **creep arches** and
   adds a brief speed kick.
4. **Hazards** — touching a spike or arch **staggers** you: input locks briefly, speed
   bleeds, the screen shakes, and you get short i-frames.
5. **Embers** — hellfire pickups give an instant speed boost. They bait the optimal
   jump/ramp lines.
6. **Beacon** — reach the hellfire pillar at the end as fast as possible. Beat your best.

## Look (DOOM aesthetic — `apps/lore/content/DESIGN.md`)

- **Runner** — a **bone** capsule with a **hellfire** core and a motion trail that reddens
  toward `bloodHot` at redline speed.
- **Ground / ramps** — **gunmetal** with **hellfire** trim.
- **Hazards / creep** — **blood**-red, with sparing **toxic**-green Scourge nodes.
- **Beacon** — a tall **hellfire** pillar.
- **Camera** — orthographic side view that tracks the runner with a slight lead, pulls
  back a touch at top speed, and shakes on impact.
- **HUD** — heavy uppercase Oswald; speed, distance, timer + best; speed-lines that
  intensify with velocity.

## Build & deploy

```bash
npm run build    # -> static dist/
npm run preview  # serve the production build locally
```

`build` is `vite build` only (no `tsc`) so a stray type nit never blocks a deploy.
This game is hosted behind the monorepo hub route. Its Vercel project should be
deployed by CLI from this monorepo, not Git-linked to a standalone game repo.
Use `bun run deploy:games:changed` at the repo root; docs-only edits skip game
deploys.

## Project layout

```
index.html             # React root
vite.config.ts          # static build to dist/
src/
  main.ts               # entry: mounts React shell, wires canvas -> Game, starts loop
  ui/AppShell.tsx       # shared UI package components + stable HUD element IDs
  game.ts               # thin Game: shared state + fixed-step loop
  constants.ts          # all tunables (feel) + DOOM palette
  types.ts              # shared types
  course.ts             # seeded, deterministic course generator
  styles.css            # DOOM HUD + juice overlays
  entities/
    runner.ts           # momentum / jump / dash / stagger physics
  systems/
    input.ts            # keyboard + pointer intent
    physics.ts          # runner vs course resolution
    render.ts           # Three.js scene, camera, trail, juice
    hud.ts              # imperative HUD adapter, timer, best-time persistence
```

## Tuning

Open `src/constants.ts`. Everything that defines feel — top speed, accel, jump velocity,
gravity, dash window, hazard cadence, camera lead/zoom — lives there. The course seed
(`COURSE.seed`) makes every run identical and fair for time-attack; change it for a new
layout.
