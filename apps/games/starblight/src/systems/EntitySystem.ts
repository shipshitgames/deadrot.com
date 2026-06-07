import * as THREE from "three";
import orbitalBreachCarrierUrl from "../assets/sprites/runtime/orbital-breach-carrier.webp";
import playerInterceptorUrl from "../assets/sprites/runtime/player-interceptor.webp";
import salvageShardUrl from "../assets/sprites/runtime/salvage-shard.webp";
import scourgeEliteUrl from "../assets/sprites/runtime/scourge-elite.webp";
import scourgeGruntUrl from "../assets/sprites/runtime/scourge-grunt.webp";
import scourgeSpitterUrl from "../assets/sprites/runtime/scourge-spitter.webp";
import scourgeSwarmlingUrl from "../assets/sprites/runtime/scourge-swarmling.webp";
import scourgeWeaverUrl from "../assets/sprites/runtime/scourge-weaver.webp";
import { COLORS, CONSTANTS, ENEMIES, type EnemyType, SPITTER, WORLD } from "../game/constants";
import type { Bullet, Enemy, EnemyBullet, Gem, Particle } from "../game/types";
import type { RenderSystem } from "./RenderSystem";

const TAU = Math.PI * 2;
const HIT_FLASH = 0.09;

type SpriteKey = "player" | "grunt" | "swarmling" | "weaver" | "spitter" | "elite" | "boss" | "salvage";

const SPRITE_SPECS: Record<SpriteKey, { url: string; aspect: number }> = {
  player: { url: playerInterceptorUrl, aspect: 116 / 132 },
  grunt: { url: scourgeGruntUrl, aspect: 75 / 114 },
  swarmling: { url: scourgeSwarmlingUrl, aspect: 40 / 94 },
  weaver: { url: scourgeWeaverUrl, aspect: 125 / 108 },
  spitter: { url: scourgeSpitterUrl, aspect: 96 / 114 },
  elite: { url: scourgeEliteUrl, aspect: 109 / 148 },
  boss: { url: orbitalBreachCarrierUrl, aspect: 114 / 196 },
  salvage: { url: salvageShardUrl, aspect: 38 / 60 },
};

const ENEMY_SPRITES: Record<EnemyType, SpriteKey> = {
  grunt: "grunt",
  swarmling: "swarmling",
  weaver: "weaver",
  spitter: "spitter",
  elite: "elite",
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
function loadSpriteTexture(key: SpriteKey): THREE.Texture {
  const tex = new THREE.TextureLoader().load(SPRITE_SPECS[key].url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  return tex;
}
function spritePlane(key: SpriteKey, height: number): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(height * SPRITE_SPECS[key].aspect, height);
}

// Owns every in-world entity: the ship (mouse-flight motion), the Scourge
// (pooled per type with chase/weave/spit AI), homing player bolts, enemy globs,
// salvage gems (magnet pickup), and particles/trail. The Game orchestrates
// damage + the survivors loop; WeaponSystem owns the auto-weapons.
export class EntitySystem {
  ship!: THREE.Group;
  private shipVel = new THREE.Vector2(0, 0);
  private shipHeading = Math.PI / 2;

  enemies: Enemy[] = [];
  bullets: Bullet[] = []; // player homing bolts (seeker + wingmates)
  enemyBullets: EnemyBullet[] = [];
  gems: Gem[] = [];
  particles: Particle[] = [];
  private effectsLevel = 1;

  // --- shared geometry/materials (created once, reused) ------------------
  private boltGeom = new THREE.BoxGeometry(0.42, 1.5, 0.42);
  private boltMat = new THREE.MeshBasicMaterial({ color: COLORS.hellfire });
  private enemyBoltGeom = new THREE.SphereGeometry(0.5, 8, 8);
  private enemyBoltMat = new THREE.MeshBasicMaterial({ color: COLORS.toxic });
  private readonly spriteTextures: Record<SpriteKey, THREE.Texture> = {
    player: loadSpriteTexture("player"),
    grunt: loadSpriteTexture("grunt"),
    swarmling: loadSpriteTexture("swarmling"),
    weaver: loadSpriteTexture("weaver"),
    spitter: loadSpriteTexture("spitter"),
    elite: loadSpriteTexture("elite"),
    boss: loadSpriteTexture("boss"),
    salvage: loadSpriteTexture("salvage"),
  };
  private shipGeom = spritePlane("player", CONSTANTS.player.height);
  private gemGeom = spritePlane("salvage", 1);
  private gemMat = this.spriteMaterial("salvage");
  private gemBigMat = this.spriteMaterial("salvage");
  private particleGeom = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  private trailGeom = new THREE.PlaneGeometry(0.9, 0.9);

  private enemyGeom: Record<EnemyType, THREE.PlaneGeometry> = {
    grunt: spritePlane("grunt", ENEMIES.grunt.size * 1.65),
    swarmling: spritePlane("swarmling", ENEMIES.swarmling.size * 1.65),
    weaver: spritePlane("weaver", ENEMIES.weaver.size * 1.65),
    spitter: spritePlane("spitter", ENEMIES.spitter.size * 1.65),
    elite: spritePlane("elite", ENEMIES.elite.size * 1.65),
  };

  // free-lists (reuse meshes instead of churning allocations)
  private boltPool: THREE.Mesh[] = [];
  private enemyBoltPool: THREE.Mesh[] = [];
  private gemPool: THREE.Mesh[] = [];
  private particlePool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private enemyPool: Record<string, { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[]> = {};

  constructor(private readonly render: RenderSystem) {}

  setEffectsLevel(level: number) {
    this.effectsLevel = Math.max(0, Math.min(1, level));
  }

  // --- ship --------------------------------------------------------------

  buildShip() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(this.shipGeom, this.spriteMaterial("player"));
    g.add(hull);

    g.position.set(0, 0, 0);
    this.ship = g;
    this.render.add(g);
  }

  resetShip() {
    this.ship.position.set(0, 0, 0);
    this.shipVel.set(0, 0);
    this.shipHeading = Math.PI / 2;
    this.ship.rotation.set(0, 0, 0);
  }

  /** Mouse-follow thrust: accelerate toward the cursor (or key axis), face
   *  travel, bank into turns, and trail thruster embers at speed. */
  moveShip(aimX: number, aimY: number, keyX: number, keyY: number, dt: number, moveMul: number, accelMul: number) {
    const p = CONSTANTS.player;
    const maxSpeed = p.maxSpeed * moveMul;
    const accel = p.accel * accelMul;

    let dvx = 0;
    let dvy = 0;
    let thrust = false;
    if (keyX !== 0 || keyY !== 0) {
      dvx = keyX * maxSpeed;
      dvy = keyY * maxSpeed;
      thrust = true;
    } else {
      const tx = aimX - this.ship.position.x;
      const ty = aimY - this.ship.position.y;
      const dist = Math.hypot(tx, ty);
      if (dist > p.followDeadzone) {
        const sp = Math.min(maxSpeed, (dist / p.followDeadzone) * maxSpeed);
        dvx = (tx / dist) * sp;
        dvy = (ty / dist) * sp;
        thrust = true;
      }
    }

    if (thrust) {
      let ax = dvx - this.shipVel.x;
      let ay = dvy - this.shipVel.y;
      const al = Math.hypot(ax, ay);
      const max = accel * dt;
      if (al > max && al > 0) {
        ax = (ax / al) * max;
        ay = (ay / al) * max;
      }
      this.shipVel.x += ax;
      this.shipVel.y += ay;
    } else {
      const d = p.drag ** (dt * 60);
      this.shipVel.multiplyScalar(d);
    }

    const sp = this.shipVel.length();
    if (sp > maxSpeed && sp > 0) this.shipVel.multiplyScalar(maxSpeed / sp);

    this.ship.position.x += this.shipVel.x * dt;
    this.ship.position.y += this.shipVel.y * dt;

    // Soft-clamp to the quarantine cage.
    const lim = WORLD.halfW - p.edgeMargin;
    if (this.ship.position.x > lim) {
      this.ship.position.x = lim;
      this.shipVel.x = Math.min(0, this.shipVel.x);
    } else if (this.ship.position.x < -lim) {
      this.ship.position.x = -lim;
      this.shipVel.x = Math.max(0, this.shipVel.x);
    }
    if (this.ship.position.y > lim) {
      this.ship.position.y = lim;
      this.shipVel.y = Math.min(0, this.shipVel.y);
    } else if (this.ship.position.y < -lim) {
      this.ship.position.y = -lim;
      this.shipVel.y = Math.max(0, this.shipVel.y);
    }

    if (sp > 0.6) {
      const target = Math.atan2(this.shipVel.y, this.shipVel.x);
      this.shipHeading = lerpAngle(this.shipHeading, target, p.headingLerp);
    }
    this.ship.rotation.z = this.shipHeading - Math.PI / 2;
    // Subtle bank: tilt the hull around its travel axis with speed.
    const bankTarget = clamp(this.shipVel.x * 0.012, -0.45, 0.45);
    this.ship.rotation.y = THREE.MathUtils.lerp(this.ship.rotation.y, bankTarget, p.bankLerp);

    if (sp > 4) this.emitTrail();
  }

  private emitTrail() {
    // A single fading hellfire quad behind the engine.
    const back = this.shipHeading + Math.PI;
    const ox = this.ship.position.x + Math.cos(back) * CONSTANTS.player.height * 0.5;
    const oy = this.ship.position.y + Math.sin(back) * CONSTANTS.player.height * 0.5;
    const { mesh, mat } = this.acquireParticle();
    mat.color.setHex(COLORS.hellfire);
    mat.opacity = 0.7;
    mat.blending = THREE.AdditiveBlending;
    mesh.geometry = this.trailGeom;
    mesh.position.set(ox, oy, -0.5);
    mesh.scale.setScalar(1);
    this.particles.push({
      mesh,
      vx: -this.shipVel.x * 0.25 + (Math.random() - 0.5) * 2,
      vy: -this.shipVel.y * 0.25 + (Math.random() - 0.5) * 2,
      life: CONSTANTS.fx.trailLife,
      maxLife: CONSTANTS.fx.trailLife,
    });
  }

  // --- enemies -----------------------------------------------------------

  spawnEnemy(type: EnemyType, x: number, y: number, hpMul: number, speedMul: number): Enemy {
    const def = ENEMIES[type];
    const isElite = type === "elite";
    const { mesh, mat } = this.acquireEnemy(type);
    mesh.position.set(x, y, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    mat.color.setHex(0xffffff);
    mat.opacity = 1;

    const maxHealth = def.baseHP * hpMul * (isElite ? CONSTANTS.director.eliteHpMul : 1);
    const enemy: Enemy = {
      mesh,
      material: mat,
      type,
      health: maxHealth,
      maxHealth,
      speed: def.speed * speedMul,
      gemValue: def.gem,
      contactDmg: def.contactDmg,
      radius: def.size * 0.7,
      flash: 0,
      phase: Math.random() * TAU,
      fireCooldown: SPITTER.fireEvery * (0.4 + Math.random() * 0.8),
      vx: 0,
      vy: 0,
      knockbackImmune: isElite,
      boss: false,
      dead: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  /** THE BLIGHT-MAW: prototype label for the Orbital Breach Carrier encounter.
   *  A bespoke big enemy the Game steers (skips chase AI), but
   *  takes damage through the normal weapon/bolt paths. */
  spawnBoss(x: number, y: number, hp: number, contactDmg: number, size: number): Enemy {
    const mat = this.spriteMaterial("boss");
    const mesh = new THREE.Mesh(spritePlane("boss", size * 2.2), mat);
    mesh.position.set(x, y, 0);
    this.render.add(mesh);
    const boss: Enemy = {
      mesh,
      material: mat,
      type: "elite",
      health: hp,
      maxHealth: hp,
      speed: 0,
      gemValue: 0,
      contactDmg,
      radius: size,
      flash: 0,
      phase: 0,
      fireCooldown: 0,
      vx: 0,
      vy: 0,
      knockbackImmune: true,
      boss: true,
      dead: false,
    };
    this.enemies.push(boss);
    return boss;
  }

  updateEnemies(dt: number, time: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const e of this.enemies) {
      if (e.dead) continue;
      // The boss is steered by the Game; it only needs flash/pulse here.
      if (e.boss) {
        const dx = sx - e.mesh.position.x;
        const dy = sy - e.mesh.position.y;
        e.mesh.rotation.z = Math.atan2(dy, dx) + Math.PI / 2;
        if (e.flash > 0) {
          e.flash = Math.max(0, e.flash - dt);
          const t = clamp(e.flash / HIT_FLASH, 0, 1);
          e.material.color.setHex(0xffffff).lerp(BONE, t);
        } else {
          const pulse = 0.5 + 0.5 * Math.sin(time * 2 + e.phase);
          e.material.color.setHex(0xffffff);
          e.material.opacity = 0.94 + pulse * 0.06;
        }
        continue;
      }
      const def = ENEMIES[e.type];
      const dx = sx - e.mesh.position.x;
      const dy = sy - e.mesh.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      if (def.behavior === "spit") {
        // Hold range and lob globs at the ship.
        let mv = 0;
        if (dist > SPITTER.range + 1) mv = e.speed;
        else if (dist < SPITTER.range - 1) mv = -e.speed * 0.6;
        e.mesh.position.x += ux * mv * dt;
        e.mesh.position.y += uy * mv * dt;
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < SPITTER.range + 6) {
          e.fireCooldown = SPITTER.fireEvery;
          this.spawnEnemyBullet(e.mesh.position.x, e.mesh.position.y, ux, uy);
        }
      } else if (def.behavior === "weave") {
        // Strafe-weave toward the ship.
        const weave = Math.sin(time * 3 + e.phase) * 0.7;
        const px = -uy;
        const py = ux;
        e.mesh.position.x += (ux + px * weave) * e.speed * dt;
        e.mesh.position.y += (uy + py * weave) * e.speed * dt;
      } else {
        // Straight chase.
        e.mesh.position.x += ux * e.speed * dt;
        e.mesh.position.y += uy * e.speed * dt;
      }

      // Knockback drift.
      if (e.vx !== 0 || e.vy !== 0) {
        e.mesh.position.x += e.vx * dt;
        e.mesh.position.y += e.vy * dt;
        const decay = 0.001 ** dt;
        e.vx *= decay;
        e.vy *= decay;
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
        if (Math.abs(e.vy) < 0.05) e.vy = 0;
      }

      e.mesh.rotation.z = Math.atan2(uy, ux) + Math.PI / 2;
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt);
        const t = clamp(e.flash / HIT_FLASH, 0, 1);
        e.material.color.setHex(0xffffff).lerp(BONE, t);
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.phase);
        e.material.color.setHex(0xffffff);
        e.material.opacity = 0.93 + pulse * 0.07;
      }
    }
  }

  hitFlash(e: Enemy) {
    e.flash = HIT_FLASH;
  }

  knockback(e: Enemy, fromX: number, fromY: number, force: number) {
    if (e.knockbackImmune) return;
    const dx = e.mesh.position.x - fromX;
    const dy = e.mesh.position.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.vx += (dx / d) * force;
    e.vy += (dy / d) * force;
  }

  killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    e.mesh.visible = false;
    if (e.boss) {
      // Bespoke mesh (not pooled): tear it down fully.
      this.render.remove(e.mesh);
      e.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
    } else {
      this.releaseEnemy(e);
    }
  }

  /** Sweep dead enemies out of the active array (swap-remove). */
  sweepEnemies() {
    let n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      if (this.enemies[i].dead) {
        this.enemies[i] = this.enemies[n - 1];
        n--;
        i--;
      }
    }
    this.enemies.length = n;
  }

  clearEnemies() {
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.killEnemy(e);
    }
    this.enemies.length = 0;
  }

  nearestEnemy(x: number, y: number, maxRange = Infinity): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.mesh.position.x - x) ** 2 + (e.mesh.position.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // --- player bolts (homing) --------------------------------------------

  spawnBolt(x: number, y: number, target: Enemy | null, dmg: number, pierce: number, speed: number, turn: number) {
    const mesh = this.acquireBolt();
    mesh.position.set(x, y, 0);
    let vx = 0;
    let vy = speed;
    if (target && !target.dead) {
      const dx = target.mesh.position.x - x;
      const dy = target.mesh.position.y - y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * speed;
      vy = (dy / d) * speed;
    }
    mesh.rotation.z = Math.atan2(vy, vx) - Math.PI / 2;
    this.bullets.push({
      mesh,
      vx,
      vy,
      damage: dmg,
      pierce,
      homing: true,
      turnRate: turn,
      target,
      hit: [],
      life: 2.2,
      dead: false,
    });
  }

  updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.homing) {
        if (!b.target || b.target.dead) b.target = this.nearestEnemy(b.mesh.position.x, b.mesh.position.y);
        if (b.target && !b.target.dead) {
          const dx = b.target.mesh.position.x - b.mesh.position.x;
          const dy = b.target.mesh.position.y - b.mesh.position.y;
          const speed = Math.hypot(b.vx, b.vy) || 1;
          const want = Math.atan2(dy, dx);
          const cur = Math.atan2(b.vy, b.vx);
          const na = lerpAngle(cur, want, Math.min(1, b.turnRate * dt));
          b.vx = Math.cos(na) * speed;
          b.vy = Math.sin(na) * speed;
        }
      }
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.rotation.z = Math.atan2(b.vy, b.vx) - Math.PI / 2;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    this.sweepBullets();
  }

  private sweepBullets() {
    let n = this.bullets.length;
    for (let i = 0; i < n; i++) {
      if (this.bullets[i].dead) {
        this.releaseBolt(this.bullets[i].mesh);
        this.bullets[i] = this.bullets[n - 1];
        n--;
        i--;
      }
    }
    this.bullets.length = n;
  }

  // --- enemy globs -------------------------------------------------------

  spawnEnemyBullet(x: number, y: number, ux: number, uy: number) {
    const mesh = this.acquireEnemyBolt();
    mesh.position.set(x, y, 0);
    this.enemyBullets.push({
      mesh,
      vx: ux * SPITTER.bulletSpeed,
      vy: uy * SPITTER.bulletSpeed,
      damage: SPITTER.bulletDmg,
      life: 4,
      dead: false,
    });
  }

  /** A generic glob (boss patterns) at an explicit velocity + damage. */
  spawnGlob(x: number, y: number, vx: number, vy: number, dmg: number) {
    const mesh = this.acquireEnemyBolt();
    mesh.position.set(x, y, 0);
    this.enemyBullets.push({ mesh, vx, vy, damage: dmg, life: 6, dead: false });
  }

  updateEnemyBullets(dt: number) {
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    let n = this.enemyBullets.length;
    for (let i = 0; i < n; i++) {
      if (this.enemyBullets[i].dead) {
        this.releaseEnemyBolt(this.enemyBullets[i].mesh);
        this.enemyBullets[i] = this.enemyBullets[n - 1];
        n--;
        i--;
      }
    }
    this.enemyBullets.length = n;
  }

  clearProjectiles() {
    for (const b of this.bullets) this.releaseBolt(b.mesh);
    this.bullets.length = 0;
    for (const b of this.enemyBullets) this.releaseEnemyBolt(b.mesh);
    this.enemyBullets.length = 0;
  }

  // --- gems --------------------------------------------------------------

  spawnGem(x: number, y: number, value: number) {
    // Enforce the live-gem cap by auto-collecting the oldest: drop it on the
    // ship so the next updateGems credits its value rather than discarding it.
    if (this.gems.length >= CONSTANTS.xp.gemCap) {
      const old = this.gems[0];
      old.mesh.position.set(this.ship.position.x, this.ship.position.y, 0);
      old.homing = true;
    }
    const big = value >= 8;
    const mesh = this.acquireGem();
    mesh.material = big ? this.gemBigMat : this.gemMat;
    mesh.position.set(x, y, 0);
    mesh.scale.setScalar(0.01);
    this.gems.push({ mesh, value, age: 0, homing: false, spawn: 0, dead: false });
  }

  /** Magnet + pickup. Returns total raw gem value collected this frame. */
  updateGems(dt: number, magnetRadius: number, vacuum: boolean): number {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    const xp = CONSTANTS.xp;
    let collected = 0;
    for (const g of this.gems) {
      if (g.dead) continue;
      g.age += dt;
      if (g.spawn < 1) {
        g.spawn = Math.min(1, g.spawn + dt * 5);
        g.mesh.scale.setScalar(0.2 + g.spawn * (g.value >= 8 ? 1.0 : 0.7));
      }
      g.mesh.rotation.y += dt * 3;
      const dx = sx - g.mesh.position.x;
      const dy = sy - g.mesh.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (vacuum) g.homing = true;
      if (!g.homing && dist < magnetRadius) g.homing = true;
      // Up close: the fast vacuum slurp. Far away: a gentle gravity-well drift so
      // the whole field always funnels toward the ship (weapons kill at range, so
      // gems would otherwise scatter unreachably across the arena).
      let speed = xp.globalPull;
      if (g.homing) {
        const near = clamp(1 - dist / Math.max(magnetRadius, 8), 0, 1);
        speed = xp.gemSpeedFar + (xp.gemSpeedNear - xp.gemSpeedFar) * near;
      }
      g.mesh.position.x += (dx / dist) * speed * dt;
      g.mesh.position.y += (dy / dist) * speed * dt;
      if (dist < xp.pickupDist) {
        collected += g.value;
        g.dead = true;
        this.pop(g.mesh.position.x, g.mesh.position.y, COLORS.ember, 4);
        continue;
      }
      // Lifetime + blink warning.
      if (g.age > xp.gemLifetime) g.dead = true;
      else if (g.age > xp.gemBlink) g.mesh.visible = Math.floor(g.age * 8) % 2 === 0;
    }
    let n = this.gems.length;
    for (let i = 0; i < n; i++) {
      if (this.gems[i].dead) {
        this.gems[i].mesh.visible = true;
        this.releaseGem(this.gems[i].mesh);
        this.gems[i] = this.gems[n - 1];
        n--;
        i--;
      }
    }
    this.gems.length = n;
    return collected;
  }

  clearGems() {
    for (const g of this.gems) {
      g.mesh.visible = true;
      this.releaseGem(g.mesh);
    }
    this.gems.length = 0;
  }

  // --- particles ---------------------------------------------------------

  pop(x: number, y: number, color: number, count: number = CONSTANTS.fx.particlePerPop) {
    const scaledCount = this.effectsLevel <= 0.01 ? 0 : Math.max(1, Math.round(count * this.effectsLevel));
    for (let i = 0; i < scaledCount; i++) {
      const { mesh, mat } = this.acquireParticle();
      mat.color.setHex(color);
      mat.opacity = 1;
      mat.blending = THREE.NormalBlending;
      mesh.geometry = this.particleGeom;
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(1);
      const a = Math.random() * TAU;
      const spd = CONSTANTS.fx.particleSpeed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        mesh,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: CONSTANTS.fx.particleLife,
        maxLife: CONSTANTS.fx.particleLife,
      });
    }
  }

  updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const t = Math.max(0, p.life / p.maxLife);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t * this.effectsLevel;
      p.mesh.scale.setScalar(0.3 + t);
    }
    let n = this.particles.length;
    for (let i = 0; i < n; i++) {
      if (this.particles[i].life <= 0) {
        this.releaseParticle(this.particles[i].mesh);
        this.particles[i] = this.particles[n - 1];
        n--;
        i--;
      }
    }
    this.particles.length = n;
  }

  clearParticles() {
    for (const p of this.particles) this.releaseParticle(p.mesh);
    this.particles.length = 0;
  }

  // --- pools -------------------------------------------------------------

  private acquireBolt(): THREE.Mesh {
    const m = this.boltPool.pop();
    if (m) {
      m.visible = true;
      return m;
    }
    const mesh = new THREE.Mesh(this.boltGeom, this.boltMat);
    this.render.add(mesh);
    return mesh;
  }
  private releaseBolt(m: THREE.Mesh) {
    m.visible = false;
    this.boltPool.push(m);
  }

  private acquireEnemyBolt(): THREE.Mesh {
    const m = this.enemyBoltPool.pop();
    if (m) {
      m.visible = true;
      return m;
    }
    const mesh = new THREE.Mesh(this.enemyBoltGeom, this.enemyBoltMat);
    this.render.add(mesh);
    return mesh;
  }
  private releaseEnemyBolt(m: THREE.Mesh) {
    m.visible = false;
    this.enemyBoltPool.push(m);
  }

  private acquireGem(): THREE.Mesh {
    const m = this.gemPool.pop();
    if (m) {
      m.visible = true;
      return m;
    }
    const mesh = new THREE.Mesh(this.gemGeom, this.gemMat);
    this.render.add(mesh);
    return mesh;
  }
  private releaseGem(m: THREE.Mesh) {
    m.visible = false;
    this.gemPool.push(m);
  }

  private acquireParticle(): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
    const slot = this.particlePool.pop();
    if (slot) {
      slot.mesh.visible = true;
      return slot;
    }
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.hellfire, transparent: true });
    const mesh = new THREE.Mesh(this.particleGeom, mat);
    this.render.add(mesh);
    return { mesh, mat };
  }
  private releaseParticle(m: THREE.Mesh) {
    m.visible = false;
    this.particlePool.push({ mesh: m, mat: m.material as THREE.MeshBasicMaterial });
  }

  private acquireEnemy(type: EnemyType): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
    this.enemyPool[type] ??= [];
    const pool = this.enemyPool[type];
    const slot = pool.pop();
    if (slot) {
      slot.mesh.visible = true;
      return slot;
    }
    const mat = this.spriteMaterial(ENEMY_SPRITES[type]);
    const mesh = new THREE.Mesh(this.enemyGeom[type], mat);
    this.render.add(mesh);
    return { mesh, mat };
  }
  private releaseEnemy(e: Enemy) {
    this.enemyPool[e.type] ??= [];
    this.enemyPool[e.type].push({ mesh: e.mesh, mat: e.material });
  }

  /** Free every GPU resource this system owns (called on teardown / HMR). */
  dispose() {
    // Ship group.
    this.render.remove(this.ship);
    this.ship.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    // Active + pooled meshes: remove from scene; dispose per-instance materials.
    for (const e of this.enemies) {
      this.render.remove(e.mesh);
      if (e.boss) e.mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      e.material.dispose();
    }
    for (const b of this.bullets) this.render.remove(b.mesh);
    for (const b of this.enemyBullets) this.render.remove(b.mesh);
    for (const g of this.gems) this.render.remove(g.mesh);
    for (const p of this.particles) {
      this.render.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const m of this.boltPool) this.render.remove(m);
    for (const m of this.enemyBoltPool) this.render.remove(m);
    for (const m of this.gemPool) this.render.remove(m);
    for (const s of this.particlePool) {
      this.render.remove(s.mesh);
      s.mat.dispose();
    }
    for (const k of Object.keys(this.enemyPool)) {
      for (const s of this.enemyPool[k]) {
        this.render.remove(s.mesh);
        s.mat.dispose();
      }
    }
    // Shared geometry/materials.
    this.boltGeom.dispose();
    this.enemyBoltGeom.dispose();
    this.gemGeom.dispose();
    this.particleGeom.dispose();
    this.trailGeom.dispose();
    for (const g of Object.values(this.enemyGeom)) g.dispose();
    for (const t of Object.values(this.spriteTextures)) t.dispose();
    this.boltMat.dispose();
    this.enemyBoltMat.dispose();
    this.gemMat.dispose();
    this.gemBigMat.dispose();
  }

  private spriteMaterial(key: SpriteKey): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      map: this.spriteTextures[key],
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
}

// Scratch colors (avoid `new THREE.Color` in hot loops).
const BONE = new THREE.Color(COLORS.bone);
