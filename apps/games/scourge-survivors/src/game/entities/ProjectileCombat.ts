import type * as THREE from "three";
import { PROJECTILE_HIT_RADIUS } from "../constants";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";

/** What a combat resolver may see of an in-flight projectile. */
export interface ProjectileView {
  /** Live world position — aliases the sprite's position vector; do not mutate. */
  readonly position: THREE.Vector3;
  readonly damage: number;
  /** Opaque integrator payload (owner enemy, fromBoss, …); resolvers that need it narrow it. */
  readonly meta: unknown;
}

/**
 * Hit-resolution seam for ProjectilesSystem. The integrator flies projectiles
 * and despawns the ones a resolver consumes; the resolver owns the hit test
 * AND its hit side effects (damage). Called once per projectile per frame,
 * before the TTL/bounds/obstacle checks. The resolver also owns broad-phase:
 * a tower-defense EnemyTargetCombat that scans every enemy per projectile is
 * O(projectiles × enemies) per frame, so any spatial culling belongs in the
 * resolver, not the integrator.
 */
export interface ProjectileCombat {
  /** Returns true when the projectile hit something and must be despawned. */
  resolveHit(view: ProjectileView): boolean;
}

/** Default combat: the classic enemy-shot-vs-player distance test. */
export class PlayerTargetCombat implements ProjectileCombat {
  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  resolveHit(view: ProjectileView): boolean {
    // Full 3D distance to the eye point — enemy shots aim at this same point.
    if (view.position.distanceTo(this.ctx.body.position) < PROJECTILE_HIT_RADIUS) {
      this.sys.player.damagePlayer(view.damage);
      return true;
    }
    return false;
  }
}
