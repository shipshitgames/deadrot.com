import type * as THREE from "three";
import type { EnemyType } from "../game/constants";
import type { Bullet, Enemy, EnemyBullet, Gem, Particle } from "../game/types";
import { BossBeam } from "./entities/bossBeam";
import { Enemies } from "./entities/enemies";
import { Gems } from "./entities/gems";
import { Particles } from "./entities/particles";
import { Projectiles } from "./entities/projectiles";
import { ShipController } from "./entities/ship";
import { createSpriteTextures } from "./entities/sprites";
import type { RenderSystem } from "./RenderSystem";

// Owns every in-world entity, composed from focused modules: the ship
// (mouse-flight motion), the Scourge (pooled per type with chase/weave/spit
// AI), homing player bolts, enemy globs, salvage gems (magnet pickup), and
// particles/trail. The Game orchestrates damage + the survivors loop;
// WeaponSystem owns the auto-weapons; BossEncounter owns the boss.
export class EntitySystem {
  private readonly textures = createSpriteTextures();
  private readonly particlesSys: Particles;
  private readonly shipSys: ShipController;
  private readonly projectilesSys: Projectiles;
  private readonly enemiesSys: Enemies;
  private readonly gemsSys: Gems;
  private readonly bossBeam: BossBeam;

  constructor(render: RenderSystem) {
    this.particlesSys = new Particles(render);
    this.shipSys = new ShipController(render, this.particlesSys, this.textures);
    this.projectilesSys = new Projectiles(render, (x, y) => this.nearestEnemy(x, y));
    this.enemiesSys = new Enemies(render, this.projectilesSys, () => this.ship, this.textures);
    this.gemsSys = new Gems(render, this.particlesSys, () => this.ship, this.textures);
    this.bossBeam = new BossBeam(render);
  }

  // --- ship ----------------------------------------------------------------

  get ship(): THREE.Group {
    return this.shipSys.ship;
  }

  buildShip() {
    this.shipSys.build();
  }

  resetShip() {
    this.shipSys.reset();
  }

  moveShip(aimX: number, aimY: number, keyX: number, keyY: number, dt: number, moveMul: number, accelMul: number) {
    this.shipSys.move(aimX, aimY, keyX, keyY, dt, moveMul, accelMul);
  }

  // --- enemies ---------------------------------------------------------------

  get enemies(): Enemy[] {
    return this.enemiesSys.enemies;
  }

  spawnEnemy(type: EnemyType, x: number, y: number, hpMul: number, speedMul: number): Enemy {
    return this.enemiesSys.spawn(type, x, y, hpMul, speedMul);
  }

  spawnBoss(x: number, y: number, hp: number, contactDmg: number, size: number): Enemy {
    return this.enemiesSys.spawnBoss(x, y, hp, contactDmg, size);
  }

  /** `skip` excludes the boss (steered + rendered by BossEncounter). */
  updateEnemies(dt: number, time: number, skip: Enemy | null = null) {
    this.enemiesSys.update(dt, time, skip);
  }

  hitFlash(e: Enemy) {
    this.enemiesSys.hitFlash(e);
  }

  knockback(e: Enemy, fromX: number, fromY: number, force: number) {
    this.enemiesSys.knockback(e, fromX, fromY, force);
  }

  killEnemy(e: Enemy) {
    this.enemiesSys.kill(e);
  }

  sweepEnemies() {
    this.enemiesSys.sweepDead();
  }

  clearEnemies() {
    this.enemiesSys.clear();
  }

  nearestEnemy(x: number, y: number, maxRange = Infinity): Enemy | null {
    return this.enemiesSys.nearest(x, y, maxRange);
  }

  // --- projectiles -----------------------------------------------------------

  get bullets(): Bullet[] {
    return this.projectilesSys.bullets;
  }

  get enemyBullets(): EnemyBullet[] {
    return this.projectilesSys.enemyBullets;
  }

  spawnBolt(x: number, y: number, target: Enemy | null, dmg: number, pierce: number, speed: number, turn: number) {
    this.projectilesSys.spawnBolt(x, y, target, dmg, pierce, speed, turn);
  }

  updateBullets(dt: number) {
    this.projectilesSys.updateBullets(dt);
  }

  spawnEnemyBullet(x: number, y: number, ux: number, uy: number) {
    this.projectilesSys.spawnEnemyBullet(x, y, ux, uy);
  }

  /** A generic glob (boss patterns) at an explicit velocity + damage. */
  spawnGlob(x: number, y: number, vx: number, vy: number, dmg: number) {
    this.projectilesSys.spawnGlob(x, y, vx, vy, dmg);
  }

  updateEnemyBullets(dt: number) {
    this.projectilesSys.updateEnemyBullets(dt);
  }

  clearProjectiles() {
    this.projectilesSys.clear();
    this.bossBeam.hide();
  }

  // --- boss beam telegraph + burn -----------------------------------------

  /** Warning line along the locked beam path; t01 ramps urgency 0 -> 1. */
  showBossBeamWarn(x1: number, y1: number, x2: number, y2: number, width: number, t01: number) {
    this.bossBeam.showWarn(x1, y1, x2, y2, width, t01);
  }

  /** The burning beam along the same locked path; t01 is remaining life 1 -> 0. */
  showBossBeamFire(x1: number, y1: number, x2: number, y2: number, width: number, t01: number) {
    this.bossBeam.showFire(x1, y1, x2, y2, width, t01);
  }

  hideBossBeam() {
    this.bossBeam.hide();
  }

  // --- gems --------------------------------------------------------------

  get gems(): Gem[] {
    return this.gemsSys.gems;
  }

  spawnGem(x: number, y: number, value: number) {
    this.gemsSys.spawn(x, y, value);
  }

  /** Magnet + pickup. Returns total raw gem value collected this frame. */
  updateGems(dt: number, magnetRadius: number, vacuum: boolean): number {
    return this.gemsSys.update(dt, magnetRadius, vacuum);
  }

  clearGems() {
    this.gemsSys.clear();
  }

  // --- particles ---------------------------------------------------------

  get particles(): Particle[] {
    return this.particlesSys.particles;
  }

  pop(x: number, y: number, color: number, count?: number) {
    this.particlesSys.pop(x, y, color, count);
  }

  updateParticles(dt: number) {
    this.particlesSys.update(dt);
  }

  clearParticles() {
    this.particlesSys.clear();
  }

  /** Free every GPU resource this system owns (called on teardown / HMR). */
  dispose() {
    this.shipSys.dispose();
    this.enemiesSys.dispose();
    this.projectilesSys.dispose();
    this.gemsSys.dispose();
    this.particlesSys.dispose();
    this.bossBeam.dispose();
    for (const t of Object.values(this.textures)) t.dispose();
  }
}
