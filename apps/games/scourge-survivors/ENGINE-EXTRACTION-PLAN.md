# `@shipshitgames/engine` extraction plan

> Output of the `engine-boundary-map` workflow (18 agents) — classify every `game/` symbol
> on the **player-embodiment** axis, design the interface that cuts each coupling seam,
> synthesize the package manifest + `CameraRig` API, and adversarially stress-test that API.

## Decision

**One `@shipshitgames/engine`** (= `engine-core` + `embodied-base`) is enough. FPS-specific code and
Scourge content **stay in `scourge-survivors`** until a 2nd consumer (Deadlane) needs them — no
`@shipshitgames/fps` package yet. The load-bearing axis is **player embodiment** ("is the player a body
in a 3D world?"), not genre.

### Classification (239 symbols)

| Tier | Count | Destination |
|---|---|---|
| `engine-core` | 36 | → package |
| `embodied-base` | 67 | → package |
| `fps-pack` | 86 | stay in scourge-survivors |
| `scourge-content` | 50 | stay in scourge-survivors |

`embodied-base` (67) being **larger than** `engine-core` confirms the convergence thesis: most of
what looked like "FPS" is actually shared embodied substrate (player controller, camera rig, agent
kinematics, projectile pool, world bounds, presence) that an embodied-3D tower-defense reuses.

**Rule of thumb.** `engine-core` = no genre, no embodiment vocabulary (loop, ctx base, DOM,
transport, snapshot shell). `embodied-base` = "player is a body in a 3D world" but NOT "player is a
shooter" (movement, collision, bounds, camera rig, agent kinematics, presence). `fps-pack` /
`scourge-content` = shooter + Scourge specifics.

## The 9 seams (genre welds to cut)

Each is cut by an injected interface so the FPS and an embodied-TD both bind it. New engine files in
**bold**; full interfaces in the workflow output.

1. **`camera/CameraRig.ts`** — replaces the hardcoded `PerspectiveCamera` + `PointerLockControls`
   on `context.ts:27-28`. Presets `firstPersonPointerLock` / `thirdPersonFollow`. *(see revised API below)*
2. **`entities/ProjectileCombat.ts`** — `resolveHit(view) → consumed?`; FPS = `PlayerTargetCombat`
   (distance-to-camera → `damagePlayer`), TD = `EnemyTargetCombat` (scan enemy set → `takeDamage`).
3. **`agents/steering.ts` + `agents/Agent.ts`** — kinematic `Agent` base + pluggable
   `SteeringStrategy` (desiredVelocity / resolveContact / resolveFire). FPS = `ChasePlayerStrategy`,
   TD = `LaneToCoreStrategy`. Boss ability cycle stays in the FPS strategy.
4. **`spawn.ts`** — `SpawnPointProvider.next(req) → {x,z,laneId?}`. FPS = arena ring, TD = lane mouths.
5. **`world/bounds.ts`** — `WorldBounds` / `RectBounds` (square default seeded from `ARENA_HALF`);
   per-frame clamps read `ctx.bounds` instead of the `ARENA_HALF` global.
6. **`modes/waveSchedule.ts` + `modes/WaveDirector.ts`** — genre-neutral wave-pacing loop; content
   via injected `WaveSchedule`. `killsThisWave++` becomes `director.notifyWaveProgress()`.
7. **`hud/types.ts` + `hud/HudSystem.ts`** — generic `HudSystem<E>` + `HudCore<E>` shell; FPS arsenal
   fields become a `ScourgeHudExt` extension. `'pointerlock-needed'`/`'levelup'` demote out of `GameStatus`.
8. **`input/bindings.ts` + `input/InputSystem.ts`** — DOM + WASD/jump in the engine; `ActionMap` /
   `CaptureRig` route weapon verbs + capture lifecycle. FPS map + `PointerLockRig` stay game-side.
9. **`net/transport.ts` + `net/presence.ts`** — `NetTransport` + `PresenceRegistry<R>`; the
   `{t:'state'|'hit'}` schema + `FpsPose` + `RemoteAvatar` stay game-side. **`party/arena.ts`
   (the PartyKit server) is a hidden 4th coupling — it stays put, does NOT migrate.**

## Manifest highlights

**MOVE whole:** `RenderSystem`, `ArenaSystem`, `FxSystem`, `storage` helpers, `spriteAssets`
loader, `AudioEngine` infra, `internalTypes.Pop`, movement constants (as default `MovementConfig`).

**STAY whole:** `WeaponSystem`, `SurvivorsSystem`, `PickupsSystem`, `data/survivors.ts`, the four
map instances, all combat/content constants, `RemoteAvatar`, `playerAvatars`, `party/arena.ts`,
`HUD.tsx`/`App.tsx`.

**SPLIT (engine half + game half):** `Game.ts` (→ `Engine` core), `context.ts` (→ `EmbodiedContext`
base + `ScourgeContext`), `systems.ts` (→ generic registry), `types.ts` (→ `HudCore` + `ScourgeHudExt`),
`Enemy.ts` (→ `Agent` + `ChasePlayerStrategy`), `ProjectilesSystem.ts`, `PlayerSystem.ts`,
`PveDirectorSystem.ts` (→ `WaveDirector` + `ScourgeWaveSchedule`), `MultiplayerSystem.ts`,
`GameOverSystem.ts`, `InputSystem.ts`, `HudSystem.ts`, `NetClient.ts`, `data/maps.ts` (schema vs
instances), `constants.ts`, `audio/AudioEngine.ts`.

## Adversarial finding — the v1 `CameraRig` failed third-person

The stress-test verdict: **first-person OK, third-person NOT OK.** The v1 interface was still
FPS-shaped. Twelve gaps; the load-bearing ones:

- **Scalar `yaw` is insufficient** — aim/net code reads the full `camera.quaternion` (pitch+yaw).
  In third-person that's the *orbit* camera's pitched-down orientation, i.e. the **wrong facing**.
  → add `readonly facing: THREE.Quaternion` (the body heading) + `pitch`.
- **No cursor→world ray** — the whole point of third-person (tower placement under a free cursor)
  was unsupported; `shoot()` raycasts screen-center only. → add `pickRay(ndcX, ndcY, out)` +
  `groundPoint(ndcX, ndcY, planeY, out)`.
- **Camera-parented view model** (`camera.add(weapon)`) renders at the orbit point in third-person.
  → add `readonly attach: THREE.Object3D` (eye/hand mount).
- **~10 systems still read `ctx.camera.position` as the player body.** The invariant must be:
  **no system names `ctx.camera.position`/`.quaternion` for player logic — only `ctx.body.position`
  / `ctx.rig.facing`; `ctx.camera` is render/projection ONLY** (the one legit read is
  `HudSystem.addDamageNumber`'s `.project(camera)`).
- Plus: `controls.isLocked/unlock()` escapes the rig in 3 unenumerated sites (`Game.dispose`,
  `GameOverSystem:57`, `SurvivorsSystem:189`); no collider feed for the boom (`setColliders`);
  no `setFov`/`zoom`; `movePlanar` distance-vs-velocity ambiguity; `placeAt` must zero pitch/roll;
  `update(delta)` must run end-of-frame after body+collision; `releaseCapture(silent)` for teardown.

→ Without this pass we'd have shipped an "engine" that could not build the embodied-TD the whole
question was about. The **revised API is the one to build to** (see below).

## Revised `CameraRig` API (build to this)

```ts
// packages/engine/src/camera/CameraRig.ts  (revised)
import type * as THREE from 'three'

export type RigCaptureEvent = 'capture' | 'release'

export interface CameraRig {
  /** Render/projection ONLY — never read camera.position/quaternion for player logic. */
  readonly camera: THREE.PerspectiveCamera
  /** Canonical player world-transform. FPS: body===camera. 3rd-person: avatar root. */
  readonly body: THREE.Object3D
  /** Eye/hand mount for first-person held items. FPS: ===camera; 3rd-person: avatar node. */
  readonly attach: THREE.Object3D
  /** Body heading the world should see (NOT the pitched orbit camera). */
  readonly facing: THREE.Quaternion
  readonly yaw: number
  readonly pitch: number
  readonly captured: boolean

  /** Move body a world-distance delta THIS FRAME in body-yaw space (caller = velocity*dt). */
  movePlanar(dx: number, dz: number): void
  /** Spawn pose: zeroes pitch/roll, faces (faceX,faceZ), snaps boom with no lerp. */
  placeAt(x: number, y: number, z: number, faceX: number, faceZ: number): void

  /** FPS passes (0,0)=center; TD passes live cursor NDC for click-place. */
  pickRay(ndcX: number, ndcY: number, out: THREE.Raycaster): void
  groundPoint(ndcX: number, ndcY: number, planeY: number, out: THREE.Vector3): boolean

  /** ArenaSystem feeds colliders so the 3rd-person boom can raycast (FPS ignores). */
  setColliders(objs: THREE.Object3D[]): void
  setFov(deg: number): void
  zoom(factor: number): void

  requestCapture(): void
  releaseCapture(silent?: boolean): void   // safe no-op if not captured
  on(ev: RigCaptureEvent, fn: () => void): void
  off(ev: RigCaptureEvent, fn: () => void): void

  /** End-of-frame: AFTER body movement + collision, BEFORE render. 3rd-person follow-lerp + boom. */
  update(delta: number): void
  resize(aspect: number): void
  dispose(): void
}

export type CameraRigPreset = (camera: THREE.PerspectiveCamera, domElement: HTMLElement) => CameraRig
export declare const firstPersonPointerLock: CameraRigPreset

export interface ThirdPersonFollowConfig {
  distance: number; height: number; followLerp: number; minDistance: number
}
export declare function thirdPersonFollow(cfg: ThirdPersonFollowConfig): CameraRigPreset
```

## `package.json` (draft)

```json
{
  "name": "@shipshitgames/engine",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "files": ["src"],
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "scripts": { "lint": "tsc --noEmit", "typecheck": "tsc --noEmit" },
  "peerDependencies": { "three": "^0.169.0" },
  "peerDependenciesMeta": { "partysocket": { "optional": true } },
  "optionalDependencies": { "partysocket": "^1.1.19" },
  "devDependencies": {
    "@types/three": "^0.169.0", "partysocket": "^1.1.19",
    "three": "^0.169.0", "typescript": "5.7.3"
  }
}
```

> **Open question (not decided here):** dev home. The draft `repository.directory` is the monorepo's
> `packages/engine`. That conflicts with the "engine is its own public MIT repo, games are
> forkable" topology. Recommended: develop in `packages/engine` via workspace/`file:` until the API
> stabilizes (Deadlane validates it), THEN split to its own public repo + publish to npm. Decide
> before scaffolding.

## Extraction checklist (seam-in-place, lowest-risk first)

0. **Scaffold** `packages/engine` (MIT, `@shipshitgames/shared` conventions, empty `src/index.ts` barrel).
1. **WorldBounds** — add `world/bounds.ts`; `ArenaSystem` publishes `ctx.bounds`; migrate clamp
   sites off `ARENA_HALF`. Keep `ARENA_HALF` as default seed (FPS provably unchanged).
2. **CameraRig** — the spine. Replace `ctx.controls` with `ctx.rig` + `body` getter; re-point
   Player/Arena/Input/Game/GameOver/Survivors. Keep `body===camera` so the ~10 camera readers compile.
3. **Input bindings + CaptureRig** — extract `fpsMap` / `FpsActionHandler` / `PointerLockRig`.
4. **SteeringStrategy + Agent** — split `Enemy.update`; `ChasePlayerStrategy` stays game-side.
5. **SpawnPointProvider** — extract `randomSpawnPoint` → `ArenaRingSpawnProvider`.
6. **ProjectileCombat** — split `ProjectilesSystem`; default to `PlayerTargetCombat`.
7. **WaveSchedule + WaveDirector** — extract `ScourgeWaveSchedule`; neutralize kill-goal counting.
8. **HudCore<E> + HudExtension** — split `types.ts`/`HudSystem`; demote genre status strings;
   delete the old flat `HUDState` so the compiler surfaces every site.
9. **NetTransport + PresenceRegistry** — split `NetClient`; `party/arena.ts` untouched.
10. **Move standalone files** (Fx/Arena/Render/storage/sprite/audio/map-schema/constants) → engine;
    re-point scourge-survivors imports to `@shipshitgames/engine`. **Gate: Scourge typechecks + builds + plays.**
11. **Write `src/index.ts` barrel**; `turbo run typecheck`; confirm the only `PointerLockControls`
    import is the FPS preset.
12. **Validate by building Deadlane on the package** — `thirdPersonFollow` rig, `LaneWaveSchedule` +
    `LaneMouthSpawnProvider`, `EnemyTargetCombat`, `TdHudExt`, click-to-build `ActionMap`. Every
    engine symbol Deadlane can't reach genre-free is a leak → fix in the engine, not in Deadlane.
    Zero `fps-pack` import = extraction validated.
13. *(deferred)* Promote `fps-pack` to its own package only on a 2nd embodied-shooter consumer.
