# STARBLIGHT // THE ORBITAL FRONT

> A top-down arcade-pilot **Vampire Survivors** — Space Invaders' grandchild grown teeth. A **Ship Shit Games** joint.

You fly a lone Warden interceptor across the **Skyhook** — the orbital ring above the surface
war — burning **Scourge** infection out of the sky before it falls. Steer with the **mouse**;
every weapon auto-aims and auto-fires, so both hands stay on flight. The Scourge converge from
all sides, drop **salvage gems** when they die, and those gems pour into an XP bar. Each level
hands you a **1-of-3 upgrade draft** — stack weapons and passives into overpowered combos and
hold the line until **THE BLIGHT-MAW** descends.

This is the studio's shared **[Survivors Loop](../../lore/content/Universe/Survivors-Loop.md)** expressed
as an arcade flyer: escalating pressure → collect → draft → synergies → orbital boss. Built with
Vite + TypeScript + React UI overlays + Three.js primitives with emissive materials.
The aesthetic is the studio's DOOM language: black void, blood red, hellfire orange, gunmetal,
bone text — and toxic green is the Scourge's color alone.

## Controls

| Input | Action |
| --- | --- |
| **Mouse** | Fly — the interceptor thrusts toward the cursor and coasts to a stop under it |
| `W` `A` `S` `D` / arrows | Keyboard flight (overrides the cursor; for mouse-free play) |
| _(automatic)_ | All weapons auto-aim and auto-fire at the nearest Scourge |
| **Click** a card / `1` `2` `3` | Pick an upgrade on the level-up draft |
| `Enter` / `Space` | Engage / re-engage from a menu |

HUD: a top **XP bar** + **level** + run **timer**; bottom-left **integrity** bar and your
**build tray** of weapon/passive chips; the **BLIGHT-MAW** health bar drops in for the boss.

## The loop

1. **Fly** through the swarm — you move at 22 u/s, grunts at ~6.5, so kiting is survival.
2. **Auto-fire** thins the Scourge; kills drop toxic-green **salvage gems**.
3. Gems **funnel** to you (a gravity-well magnet) and fill the **XP bar**.
4. Each level → **draft 1 of 3**: a new weapon, a weapon level-up, or a passive.
5. **Stack combos** — drones + crit + speed becomes a melee blender; nova + damage + area
   becomes a screen-clearing Supernova; mines + wingmates + thrusters becomes a kill conveyor.
6. Survive to **5:00** and burn **THE BLIGHT-MAW** through its three phases. Front held.

### Arsenal (drafted & stacked)

`SEEKER BOLTS` homing autocannon · `PHALANX DRONES` orbiting melee · `PYRE NOVA` shockwave ·
`WARDEN LANCE` re-aiming beam · `CINDER WAKE` trailing mines · `WINGMATE FIGHTERS` escort cannons.
Passives: `ION THRUSTERS` `REINFORCED HULL` `OVERCLOCKED REACTOR` `FOCUSING COILS`
`SALVAGE SCOOP` `PHASE FOCUSING` `BIOMASS SIPHON`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5179
npm run build      # static output -> dist/
npm run preview    # serve the built dist/
```

> `build` is `vite build` only (no `tsc` gate) so a stray type-nit never blocks a deploy.

## Deploy

This game is hosted behind the monorepo hub route. Its Vercel project should be
deployed by CLI from this monorepo, not Git-linked to a standalone game repo.
Use `bun run deploy:games:changed` at the repo root; docs-only edits skip game
deploys.

## Architecture

```
index.html          React root
src/
  main.ts           entry: mounts React shell, boots Game, owns HMR dispose
  ui/AppShell.tsx   shared UI package components + stable HUD element IDs
  styles.css        DOOM HUD styling (XP bar, draft cards, integrity, FX overlays)
  game/
    constants.ts    COLORS, WORLD, CONSTANTS, ENEMIES — all tunables
    upgrades.ts     WEAPONS / PASSIVES data tables, xpForLevel, computeStats
    types.ts        HudState + entity records
    Game.ts         orchestrator: run-state + rAF loop + director + collisions + XP/draft + boss
  systems/
    RenderSystem.ts ortho follow-camera, screenToWorld, parallax starfield, containment lattice
    InputSystem.ts  mouse NDC + WASD fallback + draft picks
    EntitySystem.ts ship flight, pooled Scourge + AI, bolts, gems (magnet), particles, the boss
    WeaponSystem.ts the auto-firing arsenal, driven by the drafted loadout
    HudSystem.ts    binds HudState to the DOM overlay + draft cards
```

### Tuning

Everything that affects feel — flight, magnet, director ramp, weapon/passive tables, boss, juice —
lives in `src/game/constants.ts` and `src/game/upgrades.ts`. Change a number, reload.

## Lore

The **Pyre** (offense) and the **Wardens** (defense) hold humanity's last frontier against the
**Scourge**. Starblight is the orbital front above the lanes of [Deadlane](../deadlane) and the
breaches of [Scourge-Survivors](../scourge-survivors). Toxic-green bio-glow is the Scourge's alone;
everything else is blood, fire, metal, and bone. See
[apps/lore/content/Games/Starblight.md](../../lore/content/Games/Starblight.md).
