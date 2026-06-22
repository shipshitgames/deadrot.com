// Point-based spawn seam for maps that author `breachSpawn` anchors (v2 layout).
//
// The engine's RectScatterSpawnProvider scatters enemies uniformly across the
// whole arena — the v1 default, and what an EMPTY breachSpawn set still means.
// When a map declares breach anchors, enemies should instead enter at those
// fixed mouths. This provider implements the same engine SpawnPointProvider seam
// so PlayerSystem.randomSpawnPoint can swap it in transparently.
//
// Engine coupling lives here (game-side) on purpose: @deadrot/game-kit/maps
// stays engine-free, so anchors are lifted into engine SpawnPoints at the game
// boundary rather than in the schema.

import type { SpawnPoint, SpawnPointProvider, SpawnRequest, WorldBounds } from "@shipshitgames/engine";

export interface BreachSpawnPoint {
  x: number;
  z: number;
}

export interface BreachSpawnConfig {
  /** Authored breach mouths (world XZ). Must be non-empty — callers fall back to
   *  the scatter provider when a map has no breach anchors. */
  points: BreachSpawnPoint[];
  /** Resolve the live play bounds each call (so a clamp picks up arena rebuilds). */
  bounds: () => WorldBounds;
  /** Reject a jittered candidate (e.g. inside an obstacle) — same predicate the
   *  scatter provider uses. */
  blocked?: (x: number, z: number) => boolean;
  /** Max random offset (metres) applied around the chosen mouth so a stream of
   *  enemies fans out instead of stacking on one pixel. Default 2.5. */
  jitter?: number;
  /** Tries to find an unblocked jittered point before falling back to the bare
   *  mouth. Default 8. */
  attempts?: number;
  /** Injectable RNG in [0,1) for deterministic tests. Default Math.random. */
  rng?: () => number;
}

/**
 * Spawns enemies at authored breach mouths instead of scattering them. Each call
 * prefers the mouth FARTHEST from the avoid point (the player), so enemies enter
 * from across the arena rather than on top of the player, then applies a small
 * jitter clamped inside the bounds and clear of obstacles.
 */
export function createBreachSpawnProvider(cfg: BreachSpawnConfig): SpawnPointProvider {
  const rng = cfg.rng ?? Math.random;
  const jitter = cfg.jitter ?? 2.5;
  const attempts = Math.max(1, cfg.attempts ?? 8);

  const pickMouth = (req: SpawnRequest): BreachSpawnPoint => {
    if (cfg.points.length === 1) return cfg.points[0];
    if (req.avoidX === undefined || req.avoidZ === undefined) {
      return cfg.points[Math.min(cfg.points.length - 1, Math.floor(rng() * cfg.points.length))];
    }
    // Farthest mouth from the avoid point, with a touch of randomness so two
    // equidistant mouths don't always lose to the first.
    let best = cfg.points[0];
    let bestScore = -Infinity;
    for (const p of cfg.points) {
      const score = Math.hypot(p.x - req.avoidX, p.z - req.avoidZ) + rng() * 4;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  };

  return {
    next(req: SpawnRequest = {}): SpawnPoint {
      const mouth = pickMouth(req);
      const bounds = cfg.bounds();
      for (let i = 0; i < attempts; i++) {
        const x = clamp(mouth.x + (rng() * 2 - 1) * jitter, bounds.minX + 1, bounds.maxX - 1);
        const z = clamp(mouth.z + (rng() * 2 - 1) * jitter, bounds.minZ + 1, bounds.maxZ - 1);
        if (!cfg.blocked?.(x, z)) return { x, z };
      }
      // Every jittered try landed on an obstacle — fall back to the bare mouth.
      return { x: mouth.x, z: mouth.z };
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
