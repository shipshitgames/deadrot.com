# Scourge Survivors map authoring

Scourge Survivors arenas are plain data in
`src/game/data/maps.ts`. Gameplay systems consume the normalized map registry,
so a new arena should not require custom collision, spawning, camera, or render
code.

## Author

1. Start from the nearest shipped v2 map shape: `FOUNDRY_WARDS` for flat rooms,
   `BREACH_PRIMUS` for levels and ramps, or `CHOIR_NODE` for a multi-room route.
2. Keep `loreId` and `front` joined to an existing canon location. Reuse that
   location's registered `materials` and `environment` unless the map ships a
   reviewed asset pack under `packages/assets`.
3. Set `bounds` only when the map intentionally differs from the default 80x80
   footprint. Rooms, obstacles, platforms, ramps, and anchors use world-space
   metres and must stay inside those bounds.
4. Author `biomeId` plus narrow `themeOverrides`; do not inline a second palette.
   For an oversized map, keep `fogFar` at or beyond the play-area diagonal and
   move distant silhouettes outside the new bounds.
5. Place exactly one `playerSpawn`. Add `breachSpawn` anchors for fixed mouths;
   omit them only when procedural scatter is intentional.

`normalizeMap` resolves the shared biome and converts authoring data through
`normalizeArenaLayout`. `ArenaSystem`, `PlayerSystem`, and the spawn providers
then read the normalized layout and live bounds.

## Preview

Run the game in sandbox mode, choose the map from the Arena section, and inspect
the live debug snapshot:

```text
/?sandbox=1
window.__fpsGame.arenaDebugSnapshot()
```

The sandbox exercises the real arena builder, collision boxes, horde grounding,
spawn providers, fog, lights, and registered assets. A shipped Survivors map is
already included in the sandbox picker; a structural experiment belongs in
`SANDBOX_MAPS` until it is ready to ship.

## Validate

Every shipped map must satisfy both shared gates:

- `validateArenaLayout(map.layout)` for bounds, room, obstacle, connector, and
  anchor integrity.
- `auditArenaReadability(map)` for fog distance, distant-silhouette placement,
  dressing opacity, floor coverage, and foreground contrast.

Focused coverage lives in `tests/unit/arena-variants.test.ts` and
`tests/unit/arena-readability.test.ts`. Runtime proof belongs in
`tests/e2e/arena-v2-maps.spec.ts`; it should start the map through the sandbox,
advance the simulation, and assert live bounds/layout plus any traversal seam
the map introduces.

## Ship

- Add player-selectable arenas to `SURVIVOR_MAPS` and `SURVIVOR_MAP_ORDER`.
- Keep canon campaign stages in `MAPS` and `JOURNEYS`; do not add a variant to
  the descent by accident.
- Keep experiments in `SANDBOX_MAPS`.
- Register any new runtime art in `packages/assets`, preserve provenance, and
  use WebP for raster output.
- Let pull-request CI run unit, typecheck, build, asset, and browser gates. Do
  not accept a map whose authored data passes while its live arena fails.

The material-production work completed in #264 remains upstream of map layout:
map authors select registered material IDs and environment assets rather than
regenerating or hand-tuning repeating textures in gameplay code. A variant can
reuse a canon location's presentation pack while independently scaling its
data-authored footprint.

## Oversized-zone reference

`FOUNDRY_WARDS` is the first oversized production proof: 144x112 metres versus
the default 80x80, or 2.52 times the floor area. Its player spawn deliberately
sits beyond the legacy -40 boundary so browser coverage detects any regression
to hardcoded default clamps. Its dressing is spread from Ashgate's registered
pack, while fog and accent lights are extended through map-local overrides.
