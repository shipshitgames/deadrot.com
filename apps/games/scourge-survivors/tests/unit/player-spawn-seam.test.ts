// #82's enemy-spawn routing seam: PlayerSystem.resolveSpawnProvider picks the
// breach-mouth provider when the active layout authors breachSpawn anchors, else
// the v1 rect scatter (an EMPTY breach set IS the v1 default). The provider is
// cached and only rebuilt when the layout reference changes. None of that was
// pinned by the geometry/collision specs, so this drives PlayerSystem directly.

import { anchorsOfKind } from "@deadrot/game-kit/maps";
import { makeBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GameContext } from "../../src/game/context";
import { MAPS, SANDBOX_MAPS } from "../../src/game/data/maps";
import { PlayerSystem } from "../../src/game/entities/PlayerSystem";
import type { GameSystems } from "../../src/game/systems";

const BOUNDS = makeBounds({ kind: "square", half: 40 });
const SCATTER_MARGIN = 3; // RectScatterSpawnProvider default inset
const GANTRY = SANDBOX_MAPS.gantry; // the only map authoring breachSpawn anchors
const FLAT = MAPS.ashgate; // a v1 campaign map: layout present, zero breach anchors
const BREACH_MOUTHS = anchorsOfKind(GANTRY.layout, "breachSpawn").map((a) => ({ x: a.x, z: a.z }));

// White-box view of the lazily-built breach provider cache (TS-private at compile time).
type SpawnCache = { breachSpawnProvider: unknown; breachLayout: unknown };

function makeSpawnHarness(currentMap: unknown, at = { x: 0, z: 30 }) {
  const ctx = {
    body: { position: new THREE.Vector3(at.x, 1.8, at.z) },
    bounds: BOUNDS,
    obstacleBoxes: [], // spawnBlocked never trips → no fallback path
    currentMap,
  } as unknown as GameContext;
  const system = new PlayerSystem(ctx, {} as GameSystems);
  return { ctx, system, priv: system as unknown as SpawnCache };
}

function nearestMouth(p: { x: number; z: number }): number {
  return Math.min(...BREACH_MOUTHS.map((m) => Math.hypot(p.x - m.x, p.z - m.z)));
}

describe("PlayerSystem spawn-seam selection (#82)", () => {
  it("falls back to the v1 rect scatter when the map authors no breach anchors", () => {
    const { system, priv } = makeSpawnHarness(FLAT);
    const p = system.randomSpawnPoint();
    // Scattered inside the arena (inset by the provider margin), not at a mouth.
    expect(p.x).toBeGreaterThanOrEqual(BOUNDS.minX + SCATTER_MARGIN);
    expect(p.x).toBeLessThanOrEqual(BOUNDS.maxX - SCATTER_MARGIN);
    expect(p.z).toBeGreaterThanOrEqual(BOUNDS.minZ + SCATTER_MARGIN);
    expect(p.z).toBeLessThanOrEqual(BOUNDS.maxZ - SCATTER_MARGIN);
    // The breach cache stays empty — the rect provider was used.
    expect(priv.breachSpawnProvider).toBeNull();
    expect(priv.breachLayout).toBeNull();
  });

  it("routes through the breach-mouth provider when the layout authors breach anchors", () => {
    const { system, priv } = makeSpawnHarness(GANTRY);
    // The jitter is bounded (±2.5 per axis), so every spawn lands within
    // 2.5·√2 of an authored mouth — a uniform 80×80 scatter would not.
    const reach = 2.5 * Math.SQRT2 + 1e-6;
    for (let i = 0; i < 25; i++) {
      expect(nearestMouth(system.randomSpawnPoint())).toBeLessThanOrEqual(reach);
    }
    expect(priv.breachSpawnProvider).not.toBeNull();
    expect(priv.breachLayout).toBe(GANTRY.layout);
  });

  it("caches the breach provider per layout and rebuilds it only when the layout changes", () => {
    const { ctx, system, priv } = makeSpawnHarness(GANTRY);
    system.randomSpawnPoint();
    const first = priv.breachSpawnProvider;
    expect(first).not.toBeNull();

    // Same layout reference → reuse the cached provider.
    system.randomSpawnPoint();
    expect(priv.breachSpawnProvider).toBe(first);

    // A different layout reference (still with breaches) → rebuild.
    ctx.currentMap = { ...GANTRY, layout: { ...GANTRY.layout } } as GameContext["currentMap"];
    system.randomSpawnPoint();
    expect(priv.breachSpawnProvider).not.toBe(first);
    expect(priv.breachSpawnProvider).not.toBeNull();

    // Switching to a flat (no-breach) map resets the cache back to the rect seam.
    ctx.currentMap = FLAT;
    system.randomSpawnPoint();
    expect(priv.breachSpawnProvider).toBeNull();
    expect(priv.breachLayout).toBeNull();
  });
});
