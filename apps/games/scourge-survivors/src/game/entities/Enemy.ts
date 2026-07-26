import { Agent, type PlanarVec, type SteeringStrategy, type WorldBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import {
  BOSS_BARRAGE_COUNT,
  BOSS_BARRAGE_SPREAD,
  BOSS_ENRAGE_HEALTH_FRAC,
  BOSS_ENRAGE_SPEED_MULT,
  BOSS_SHIELD_DURATION,
  BOSS_SKILL_INTERVAL,
  ELITE_AFFIXES,
  type EliteAffixId,
  ENEMY_ATTACK_DAMAGE,
  ENEMY_ATTACK_INTERVAL,
  ENEMY_ATTACK_RANGE,
  ENEMY_FIRE_INTERVAL,
  ENEMY_FIRE_RANGE,
  ENEMY_MAX_HEALTH,
  ENEMY_PREFERRED_RANGE,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED,
  ENEMY_RADIUS,
  ENEMY_SEPARATION,
  ENEMY_SPEED_MAX,
  ENEMY_SPEED_MIN,
} from "../constants";
import { ENEMY_ARCHETYPES, type EnemyArchetypeId } from "../data/enemies";
import {
  copyEnemyPose,
  createEnemyPose,
  type EnemyAnimState,
  evaluateEnemyPose,
} from "../render/models/enemyAnimation";
import {
  applyEnemyRigPose,
  buildEnemyRig,
  configureEnemyRig,
  disposeEnemyRig,
  type EnemyRig,
  type EnemyRigKind,
  type EnemyRigPalette,
  resetEnemyRigPose,
} from "../render/models/enemyRig";
import { chasePlayerStrategy, redirectBlockedRangedRetreat } from "./ChasePlayerStrategy";

const HEALTHBAR_WIDTH = 0.95;
const BOSS_HIT_RADIUS_TO_VISUAL_WIDTH = 0.3;
const BOSS_BASE_VISUAL_WIDTH = 3.3;
// Keep oversized boss variants navigable in crowded arenas; the clamp is still
// wider than the legacy boss radius while preventing Reaper-scale body blocking.
const BOSS_HIT_RADIUS_MAX = 3;
const BOSS_SHIELD_RADIUS = 1.5;
const ANIMATION_CROSSFADE_DURATION = 0.12;
const ATTACK_ANIMATION_DURATION = 0.72;
const HIT_ANIMATION_DURATION = 0.24;

export interface DamageResult {
  died: boolean;
  headshot: boolean;
  blocked: boolean;
}

/**
 * Everything a corpse needs to stand where its enemy fell, captured at the
 * moment of death because none of it survives the frame.
 *
 * `kill()` has to hide the dying enemy immediately: the pool hands the first
 * `!alive` enemy to the very next spawn (`PveDirectorSystem.getFreeEnemy`), and
 * a dead enemy's hit meshes stay registered in `ctx.raycastTargets` for the
 * lifetime of the pool while THREE's raycaster ignores `visible` — so parking
 * the group underground is what stops a body soaking bullets. The rig therefore
 * cannot play its own death clip, and `FxSystem` stands a separate pooled rig up
 * from this snapshot instead.
 */
export interface EnemyDeathSnapshot {
  kind: EnemyRigKind;
  x: number;
  /** Height it died at — a winged host dies in the air. */
  y: number;
  z: number;
  /** Floor beneath that spot, so the fall has somewhere to land. */
  groundY: number;
  yaw: number;
  scale: number;
  /** The look to copy, never to share: this rig is about to be restyled. */
  palette: EnemyRigPalette;
}

/** A single shot the enemy wants to fire this frame. */
export interface EnemyShot {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  damage: number;
  speed: number;
  fromBoss: boolean;
}

export interface EnemyTick {
  melee: number;
  shots: EnemyShot[];
}

export interface SpawnConfig {
  archetype?: EnemyArchetypeId;
  maxHealth?: number;
  speed?: number;
  scale?: number;
  color?: number;
  isBoss?: boolean;
  ranged?: boolean;
  flying?: boolean;
  hoverHeight?: number;
  /** Authored walkable surface beneath this spawn (zero for flat arenas). */
  groundHeight?: number;
  splitCount?: number;
  /** Elite wave affix: tints the rig and drives affix behaviour (Survivors). */
  eliteAffix?: EliteAffixId | null;
  /** Damage absorbed before health (the "shielded" elite affix). */
  overshield?: number;
  attackDamage?: number;
  attackInterval?: number;
  attackRange?: number;
  projectileDamage?: number;
  projectileSpeed?: number;
  preferredRange?: number;
}

/**
 * A single enemy "bot". Melee bots close in and swipe; ranged bots keep their
 * distance and fire projectiles. The boss does both and runs an ability cycle
 * (shield / enrage / projectile barrage). The {@link Game} owns the pool, spawns
 * per wave, resolves obstacle collision and turns {@link EnemyShot}s into live
 * projectiles.
 */
export class Enemy extends Agent {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];

  maxHealth = ENEMY_MAX_HEALTH;
  health = ENEMY_MAX_HEALTH;
  isBoss = false;
  ranged = false;
  flying = false;
  hoverHeight = 0;
  private groundHeight = 0;
  archetype: EnemyArchetypeId = "grunt";
  splitCount = 0;
  /** Elite wave affix (left intact through kill() so death handlers can read it). */
  eliteAffix: EliteAffixId | null = null;
  /** Remaining overshield (the "shielded" elite affix absorbs hits before health). */
  overshield = 0;
  private eliteTint = new THREE.Color();
  /** Set by the steering strategy: a ranged bot backing off holds its fire. */
  retreating = false;

  // hit reaction: a brief white-hot flash + scale punch so bullets visibly
  // CONNECT (set by takeDamage). The decaying knockback shove lives on Agent.
  hitFlash = 0;
  staggerTimer = 0;
  private telegraphTimer = 0;
  private chargeWindup = 0;
  private chargeTimer = 0;
  private chargeCooldown = 0;
  private chargeDirX = 0;
  private chargeDirZ = 0;

  /** Pluggable movement policy (default: the Scourge chase/kite steering). */
  private steering: SteeringStrategy<Enemy> = chasePlayerStrategy;

  // boss ability state
  shielded = false;
  enraged = false;

  private attackDamage = ENEMY_ATTACK_DAMAGE;
  private attackInterval = ENEMY_ATTACK_INTERVAL;
  /** Read by the steering strategy: melee closes inside this range. */
  attackRange = ENEMY_ATTACK_RANGE;
  private projectileDamage = ENEMY_PROJECTILE_DAMAGE;
  private projectileSpeed = ENEMY_PROJECTILE_SPEED;
  /** Read by the steering strategy: ranged bots hold this gap. */
  preferredRange = ENEMY_PREFERRED_RANGE;
  private fireInterval = ENEMY_FIRE_INTERVAL;

  private baseSpeed = ENEMY_SPEED_MIN;
  private baseAttackInterval = ENEMY_ATTACK_INTERVAL;
  private shieldTimer = 0;
  private skillTimer = BOSS_SKILL_INTERVAL;
  private skillToggle = 0;

  private attackTimer = 0;
  private fireTimer = 0;
  private bobPhase = 0;
  /** Read by the steering strategy: which way a ranged bot strafes. */
  strafeSign = 1;

  private rig: EnemyRig;
  private eyeMat: THREE.MeshStandardMaterial;
  private healthFill: THREE.Mesh;
  private healthBarGroup = new THREE.Group();
  private shieldMesh: THREE.Mesh;
  private tellMesh: THREE.Mesh;
  private animationState: EnemyAnimState = "idle";
  private animationStateTime = 0;
  private animationBlend = 1;
  private animationGaitPhase = 0;
  private attackAnimationTimer = 0;
  private currentPose = createEnemyPose();
  private transitionPose = createEnemyPose();
  private styleColor = 0xff5a3c;
  private flashApplied = false;
  private muzzle = new THREE.Vector3();
  /** Replaced wholesale by {@link kill}; read by {@link deathFx} right after. */
  private deathSnapshot: EnemyDeathSnapshot;

  constructor() {
    super();
    this.rig = buildEnemyRig("melee");
    this.deathSnapshot = { kind: "melee", x: 0, y: 0, z: 0, groundY: 0, yaw: 0, scale: 1, palette: this.rig.palette };
    this.eyeMat = this.rig.palette.eye;
    for (const mesh of this.rig.hitMeshes) {
      mesh.userData.enemy = this;
    }
    this.hitMeshes.push(...this.rig.hitMeshes);
    this.group.add(this.rig.root);

    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTHBAR_WIDTH + 0.08, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    this.healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTHBAR_WIDTH, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff6a00, depthWrite: false }),
    );
    this.healthFill.position.z = 0.001;
    this.healthBarGroup.add(barBg, this.healthFill);
    this.healthBarGroup.position.y = 2.45;
    this.group.add(this.healthBarGroup);

    // Boss shield bubble (hidden unless the boss raises it).
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOSS_SHIELD_RADIUS, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0x39c7ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.shieldMesh.position.y = 1.2;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    this.tellMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.46, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.tellMesh.position.y = 1.35;
    this.tellMesh.visible = false;
    this.group.add(this.tellMesh);

    this.group.visible = false;
    this.group.position.y = -100;
  }

  spawnAt(x: number, z: number, cfg: SpawnConfig = {}) {
    this.archetype = cfg.archetype ?? (cfg.ranged ? "shooter" : "grunt");
    const archetype = ENEMY_ARCHETYPES[this.archetype];
    this.maxHealth = cfg.maxHealth ?? ENEMY_MAX_HEALTH;
    this.health = this.maxHealth;
    this.alive = true;
    this.isBoss = cfg.isBoss ?? false;
    this.ranged = cfg.ranged ?? archetype.ranged ?? false;
    this.flying = cfg.flying ?? archetype.flying ?? false;
    this.hoverHeight = this.flying ? (cfg.hoverHeight ?? archetype.hoverHeight ?? 2.05) : 0;
    this.groundHeight = cfg.groundHeight ?? 0;
    this.splitCount = cfg.splitCount ?? archetype.splitCount ?? 0;
    this.baseSpeed = cfg.speed ?? ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN);
    this.speed = this.baseSpeed;
    this.baseAttackInterval = cfg.attackInterval ?? ENEMY_ATTACK_INTERVAL;
    this.attackInterval = this.baseAttackInterval;
    this.attackDamage = cfg.attackDamage ?? archetype.attackDamage ?? ENEMY_ATTACK_DAMAGE;
    this.attackRange = cfg.attackRange ?? ENEMY_ATTACK_RANGE;
    this.projectileDamage = cfg.projectileDamage ?? ENEMY_PROJECTILE_DAMAGE;
    this.projectileSpeed = cfg.projectileSpeed ?? ENEMY_PROJECTILE_SPEED;
    this.preferredRange = cfg.preferredRange ?? ENEMY_PREFERRED_RANGE;
    this.fireInterval = ENEMY_FIRE_INTERVAL;

    this.attackTimer = this.attackInterval;
    this.fireTimer = this.fireInterval * (0.5 + Math.random());
    this.bobPhase = Math.random() * Math.PI * 2;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;

    this.shielded = false;
    this.enraged = false;
    this.shieldTimer = 0;
    this.skillTimer = BOSS_SKILL_INTERVAL;
    this.skillToggle = 0;
    this.eliteAffix = cfg.eliteAffix ?? null;
    this.overshield = Math.max(0, cfg.overshield ?? 0);
    if (this.eliteAffix) this.eliteTint.setHex(ELITE_AFFIXES[this.eliteAffix].tint).multiplyScalar(1.35);
    // The boss bubble doubles as the elite overshield (bone-tinted, depletes on hits).
    const shieldMat = this.shieldMesh.material as THREE.MeshBasicMaterial;
    shieldMat.color.setHex(this.overshield > 0 ? ELITE_AFFIXES.shielded.tint : 0x39c7ff);
    shieldMat.opacity = 0.25;
    this.shieldMesh.visible = this.overshield > 0;
    this.hitFlash = 0;
    this.staggerTimer = 0;
    this.telegraphTimer = 0;
    this.chargeWindup = 0;
    this.chargeTimer = 0;
    this.chargeCooldown = 1.1 + Math.random() * 1.2;
    this.animationState = this.flying ? "hover" : "idle";
    this.animationStateTime = 0;
    this.animationBlend = 1;
    this.animationGaitPhase = this.bobPhase;
    this.attackAnimationTimer = 0;
    this.flashApplied = false;
    this.knockX = 0;
    this.knockZ = 0;
    this.tellMesh.visible = false;

    const scale = cfg.scale ?? 1;
    configureEnemyRig(this.rig, this.enemyKind());
    resetEnemyRigPose(this.rig);
    this.group.scale.setScalar(scale);
    this.radius = this.isBoss
      ? Math.min(BOSS_BASE_VISUAL_WIDTH * scale * BOSS_HIT_RADIUS_TO_VISUAL_WIDTH, BOSS_HIT_RADIUS_MAX)
      : ENEMY_RADIUS * (this.flying ? scale * 0.72 : 1);
    const bossShieldScale = BOSS_BASE_VISUAL_WIDTH / (BOSS_SHIELD_RADIUS * 2);
    this.shieldMesh.scale.set(this.isBoss ? bossShieldScale : 1, 1, this.isBoss ? bossShieldScale : 1);

    this.applyStyle(cfg.color ?? 0xff5a3c);
    this.group.position.set(x, this.groundHeight + this.hoverHeight, z);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    evaluateEnemyPose(this.animationState, this.enemyKind(), 0, 0, 1, undefined, this.currentPose);
    copyEnemyPose(this.currentPose, this.transitionPose);
    applyEnemyRigPose(this.rig, this.currentPose);
    this.rig.muzzle.getWorldPosition(this.muzzle);
    this.updateHealthBar();
  }

  private enemyKind(): EnemyRigKind {
    if (this.isBoss) return "boss";
    if (this.flying) return "flying";
    if (this.archetype === "hound") return "hound";
    return this.ranged ? "ranged" : "melee";
  }

  deathFx() {
    return {
      kind: this.enemyKind(),
      view: "front" as const,
      flip: 1,
      /** Captured by {@link kill} — by now the group is already parked underground. */
      corpse: this.deathSnapshot,
    };
  }

  private applyStyle(color: number) {
    this.styleColor = color;
    const { body, dark, accent, eye } = this.rig.palette;
    if (this.isBoss) {
      body.color.setHex(color);
      body.emissive.setHex(color);
      body.emissiveIntensity = 0.9;
      body.metalness = 0.1;
      body.roughness = 0.45;
      dark.color.setHex(0x17151b);
      dark.emissive.setHex(0x2d0710);
      dark.emissiveIntensity = 0.8;
      accent.color.setHex(0xb6e61d);
      accent.emissive.setHex(0x6d990b);
      accent.emissiveIntensity = 1.8;
      eye.color.setHex(0xffffff);
      eye.emissive.setHex(0xffe000);
      eye.emissiveIntensity = 4;
      (this.healthFill.material as THREE.MeshBasicMaterial).color.setHex(0xff2d55);
    } else {
      body.color.setHex(color);
      body.emissive.copy(body.color).multiplyScalar(this.ranged ? 0.45 : 0.22);
      body.emissiveIntensity = 1;
      body.metalness = 0.25;
      body.roughness = 0.55;
      dark.color.setHex(this.flying ? 0x202615 : 0x181b22);
      dark.emissive.copy(body.emissive).multiplyScalar(0.22);
      dark.emissiveIntensity = 0.65;
      accent.color.setHex(this.ranged ? 0x35e0ff : 0x8bdc1f);
      accent.emissive.copy(accent.color).multiplyScalar(0.62);
      accent.emissiveIntensity = 1.45;
      eye.color.setHex(0xffffff);
      eye.emissive.setHex(this.ranged ? 0x35e0ff : 0xff3b30);
      eye.emissiveIntensity = this.ranged ? 3 : 2.2;

      if (this.eliteAffix) {
        body.color.lerp(this.eliteTint, 0.58);
        body.emissive.copy(this.eliteTint).multiplyScalar(0.42);
        dark.color.lerp(this.eliteTint, 0.28);
        accent.color.copy(this.eliteTint);
        accent.emissive.copy(this.eliteTint).multiplyScalar(0.72);
      }
    }
  }

  private triggerAttackAnimation() {
    this.attackAnimationTimer = Math.max(this.attackAnimationTimer, ATTACK_ANIMATION_DURATION);
  }

  private transitionAnimation(next: EnemyAnimState) {
    if (this.animationState === next) return;
    copyEnemyPose(this.currentPose, this.transitionPose);
    this.animationState = next;
    this.animationStateTime = 0;
    this.animationBlend = 0;
  }

  private updateRigAnimation(delta: number, moveSpeed: number) {
    const speed01 = Math.min(1, moveSpeed / Math.max(0.001, this.speed));
    this.animationGaitPhase += delta * (4.2 + speed01 * 5.8);
    if (this.attackAnimationTimer > 0) {
      this.attackAnimationTimer = Math.max(0, this.attackAnimationTimer - delta);
    }

    let next: EnemyAnimState;
    if (this.staggerTimer > 0) next = "hit";
    else if (this.attackAnimationTimer > 0 || this.telegraphTimer > 0 || this.chargeWindup > 0) next = "attack";
    else if (this.flying) next = "hover";
    else if (speed01 > 0.72) next = "run";
    else if (speed01 > 0.04) next = "walk";
    else next = "idle";
    this.transitionAnimation(next);

    this.animationStateTime += delta;
    this.animationBlend = Math.min(1, this.animationBlend + delta / ANIMATION_CROSSFADE_DURATION);
    let sampleTime = this.animationStateTime;
    if (this.animationState === "walk" || this.animationState === "run" || this.animationState === "hover") {
      sampleTime = this.animationGaitPhase;
    } else if (this.animationState === "attack") {
      sampleTime = Math.min(1, this.animationStateTime / ATTACK_ANIMATION_DURATION);
    } else if (this.animationState === "hit") {
      sampleTime = Math.min(1, this.animationStateTime / HIT_ANIMATION_DURATION);
    }
    evaluateEnemyPose(
      this.animationState,
      this.enemyKind(),
      sampleTime,
      speed01,
      this.animationBlend,
      this.transitionPose,
      this.currentPose,
    );
    applyEnemyRigPose(this.rig, this.currentPose);
  }

  private updateRigReaction() {
    const flash = this.hitFlash > 0 ? this.hitFlash / 0.08 : 0;
    if (flash <= 0) {
      this.rig.root.scale.setScalar(1);
      if (this.flashApplied) {
        this.flashApplied = false;
        this.applyStyle(this.styleColor);
      }
      return;
    }

    this.flashApplied = true;
    const punch = 1 + flash * 0.26;
    this.rig.root.scale.setScalar(punch);
    for (const material of this.rig.materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.color.setRGB(1 + flash * 1.5, 1 + flash * 1.15, 1 + flash * 0.9);
      material.emissive.setRGB(1.2 * flash, 0.72 * flash, 0.42 * flash);
      material.emissiveIntensity = 1.4;
    }
  }

  /** Advance one frame. Obstacle collision is resolved by the Game afterwards. */
  update(
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    peers: Enemy[],
    cameraQuat: THREE.Quaternion,
    bounds: WorldBounds,
    /** Walkable height at (x,z). `fromY` is the storey the enemy is currently
     *  standing on, so the resolver can keep it under a building deck instead of
     *  teleporting it to the roof. */
    groundHeightAt?: (x: number, z: number, fromY: number) => number,
  ): EnemyTick {
    const tick: EnemyTick = { melee: 0, shots: [] };
    if (!this.alive) return tick;

    const pos = this.group.position;
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.0001 ? dx / dist : 0;
    const dirZ = dist > 0.0001 ? dz / dist : 0;

    const move: PlanarVec = { x: 0, z: 0 };

    if (this.staggerTimer > 0) this.staggerTimer = Math.max(0, this.staggerTimer - delta);
    if (this.chargeCooldown > 0) this.chargeCooldown = Math.max(0, this.chargeCooldown - delta);

    const canCharge = !this.isBoss && this.archetype === "charger" && dist > 4.5 && dist < 18;
    if (canCharge && this.chargeCooldown <= 0 && this.chargeWindup <= 0 && this.chargeTimer <= 0) {
      this.chargeWindup = 0.42;
      this.chargeDirX = dirX;
      this.chargeDirZ = dirZ;
      this.eyeMat.emissiveIntensity = 6;
    }

    let suppressSteering = false;
    if (this.chargeWindup > 0) {
      this.chargeWindup -= delta;
      this.chargeDirX = dirX;
      this.chargeDirZ = dirZ;
      suppressSteering = true;
      if (this.chargeWindup <= 0) {
        this.chargeTimer = 0.55;
        this.chargeCooldown = 3.2 + Math.random() * 1.2;
      }
    }

    if (this.chargeTimer > 0) {
      this.chargeTimer = Math.max(0, this.chargeTimer - delta);
      move.x += this.chargeDirX * this.speed * 3.1;
      move.z += this.chargeDirZ * this.speed * 3.1;
    } else if (!suppressSteering) {
      // separation (boids peer-repulsion), scaled into the move intent
      this.separation(peers, ENEMY_SEPARATION, move, (other) => (this.isBoss || other.isBoss ? 1.2 : 0));
      move.x *= this.speed * 0.6;
      move.z *= this.speed * 0.6;

      // steering intent (chase / kite / strafe) added on top of separation
      this.steering.desiredVelocity(this, { dist, dirX, dirZ }, move);
      if (this.retreating) {
        const blocked = redirectBlockedRangedRetreat(
          pos,
          move,
          { dirX, dirZ },
          {
            bounds,
            delta,
            margin: 1.5,
            speed: this.speed,
            strafeSign: this.strafeSign,
          },
        );
        if (blocked) this.retreating = false;
      }
    }

    const staggerMoveMul = this.staggerTimer > 0 ? (this.isBoss ? 0.72 : this.archetype === "tank" ? 0.48 : 0.18) : 1;
    move.x *= staggerMoveMul;
    move.z *= staggerMoveMul;
    pos.x += move.x * delta;
    pos.z += move.z * delta;

    // knockback shove from being shot — decays fast so it reads as a flinch
    this.applyKnockback(delta);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - delta);
    if (this.overshield > 0 && this.shieldMesh.visible) {
      // ease the absorb-ping flash back down to the resting shimmer
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial;
      if (m.opacity > 0.25) m.opacity = Math.max(0.25, m.opacity - delta * 1.4);
    }

    bounds.clampXZ(pos, 1.5);
    if (groundHeightAt) this.groundHeight = groundHeightAt(pos.x, pos.z, this.groundHeight);

    const moveSpeed = Math.hypot(move.x, move.z);
    const facesTarget = this.ranged || this.isBoss || this.telegraphTimer > 0 || moveSpeed <= 0.05;
    this.group.rotation.y = facesTarget ? Math.atan2(dirX, dirZ) : Math.atan2(move.x, move.z);
    pos.y =
      this.groundHeight +
      (this.flying
        ? this.hoverHeight + Math.sin(elapsed * (this.speed * 1.25) + this.bobPhase) * 0.18
        : Math.abs(Math.sin(elapsed * (this.speed * 1.6) + this.bobPhase)) * 0.07);
    this.updateRigAnimation(delta, moveSpeed);
    this.updateRigReaction();
    this.rig.muzzle.getWorldPosition(this.muzzle);
    this.healthBarGroup.quaternion.copy(cameraQuat);
    this.updateTell(delta);

    // ---- boss abilities
    if (this.isBoss) this.updateBoss(delta, elapsed, dirX, dirZ, dist, playerPos, tick);

    // ---- melee
    const canAct = this.staggerTimer <= 0.02 && this.chargeWindup <= 0;
    if (canAct && dist <= this.attackRange) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        tick.melee += this.attackDamage;
        this.attackTimer = this.attackInterval;
        this.triggerAttackAnimation();
        this.eyeMat.emissiveIntensity = this.isBoss ? 7 : 4.5;
      }
    }
    const restEye = this.isBoss ? 4 : this.ranged ? 3 : 2.2;
    if (this.eyeMat.emissiveIntensity > restEye) {
      this.eyeMat.emissiveIntensity = Math.max(restEye, this.eyeMat.emissiveIntensity - delta * 12);
    }

    // ---- ranged fire (mobs and boss). Mobs hold fire while backing away.
    if (canAct && (this.isBoss || this.ranged || this.telegraphTimer > 0) && dist <= ENEMY_FIRE_RANGE) {
      if (this.telegraphTimer > 0) {
        this.telegraphTimer -= delta;
        if (this.telegraphTimer <= 0) {
          tick.shots.push(this.makeShot(playerPos, 0));
          this.fireTimer = this.fireInterval * (this.enraged ? 0.6 : 1);
        }
      } else if (this.isBoss || !this.retreating) {
        this.fireTimer -= delta;
        if (this.fireTimer <= 0) {
          this.telegraphTimer = this.isBoss ? 0.16 : 0.34;
          this.triggerAttackAnimation();
          this.eyeMat.emissiveIntensity = this.isBoss ? 7 : 5.6;
        }
      }
    } else if (this.telegraphTimer > 0) {
      this.telegraphTimer -= delta;
      if (this.telegraphTimer <= 0 && canAct) {
        tick.shots.push(this.makeShot(playerPos, 0));
        this.fireTimer = this.fireInterval * (this.enraged ? 0.6 : 1);
      }
    }

    return tick;
  }

  private updateTell(delta: number) {
    const active = this.telegraphTimer > 0 || this.chargeWindup > 0;
    this.tellMesh.visible = active;
    if (!active) return;
    const mat = this.tellMesh.material as THREE.MeshBasicMaterial;
    const isShot = this.telegraphTimer > 0;
    mat.color.setHex(isShot ? 0x7fd8ff : 0xffb02e);
    mat.opacity = isShot
      ? 0.38 + Math.sin(this.telegraphTimer * 48) * 0.18
      : 0.52 + Math.sin(this.chargeWindup * 40) * 0.2;
    this.tellMesh.rotation.z += delta * (isShot ? -7 : 10);
    const pulse = isShot
      ? 1 + Math.sin(this.telegraphTimer * 34) * 0.16
      : 1.2 + Math.sin(this.chargeWindup * 30) * 0.24;
    this.tellMesh.scale.setScalar(pulse);
  }

  private updateBoss(
    delta: number,
    elapsed: number,
    dirX: number,
    dirZ: number,
    _dist: number,
    playerPos: THREE.Vector3,
    tick: EnemyTick,
  ) {
    // Enrage once below the health threshold.
    if (!this.enraged && this.health / this.maxHealth < BOSS_ENRAGE_HEALTH_FRAC) {
      this.enraged = true;
      this.speed = this.baseSpeed * BOSS_ENRAGE_SPEED_MULT;
      this.attackInterval = this.baseAttackInterval * 0.6;
    }

    // Shield lifetime + pulse.
    if (this.shielded) {
      this.shieldTimer -= delta;
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.22 + Math.sin(elapsed * 10) * 0.1;
      if (this.shieldTimer <= 0) {
        this.shielded = false;
        this.shieldMesh.visible = false;
      }
    }

    // Ability cycle.
    this.skillTimer -= delta;
    if (this.skillTimer <= 0) {
      if (this.skillToggle % 2 === 0) {
        // raise shield
        this.shielded = true;
        this.shieldTimer = BOSS_SHIELD_DURATION;
        this.shieldMesh.visible = true;
      } else {
        // projectile barrage fanned around the player direction
        this.triggerAttackAnimation();
        const base = Math.atan2(dirX, dirZ);
        const denom = Math.max(1, BOSS_BARRAGE_COUNT - 1);
        for (let i = 0; i < BOSS_BARRAGE_COUNT; i++) {
          const t = i / denom - 0.5;
          const ang = base + t * BOSS_BARRAGE_SPREAD;
          tick.shots.push(this.makeShotAngle(playerPos, ang));
        }
      }
      this.skillToggle++;
      this.skillTimer = BOSS_SKILL_INTERVAL * (this.enraged ? 0.7 : 1);
    }
  }

  private chestOrigin(): THREE.Vector3 {
    return this.rig.muzzle.getWorldPosition(this.muzzle);
  }

  private makeShot(playerPos: THREE.Vector3, jitter: number): EnemyShot {
    const origin = this.chestOrigin().clone();
    const dir = new THREE.Vector3(playerPos.x - origin.x, playerPos.y - origin.y, playerPos.z - origin.z).normalize();
    const j = jitter || (this.isBoss ? 0.02 : 0.045);
    dir.x += (Math.random() * 2 - 1) * j;
    dir.y += (Math.random() * 2 - 1) * j * 0.5;
    dir.z += (Math.random() * 2 - 1) * j;
    dir.normalize();
    return { origin, dir, damage: this.projectileDamage, speed: this.projectileSpeed, fromBoss: this.isBoss };
  }

  private makeShotAngle(playerPos: THREE.Vector3, yaw: number): EnemyShot {
    const origin = this.chestOrigin().clone();
    // aim slightly up toward the player's height, fanned on the yaw
    const dy = (playerPos.y - origin.y) * 0.15;
    const dir = new THREE.Vector3(Math.sin(yaw), dy, Math.cos(yaw)).normalize();
    return { origin, dir, damage: this.projectileDamage, speed: this.projectileSpeed, fromBoss: this.isBoss };
  }

  takeDamage(amount: number, headshot: boolean, knock = 0, kx = 0, kz = 0): DamageResult {
    if (!this.alive) return { died: false, headshot, blocked: false };
    if (this.shielded) {
      // flash the shield to acknowledge the blocked hit
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.6;
      return { died: false, headshot, blocked: true };
    }
    if (this.overshield > 0) {
      // elite overshield: absorb the hit, ping the bubble, drop it once spent
      this.overshield = Math.max(0, this.overshield - amount);
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.6;
      if (this.overshield <= 0) this.shieldMesh.visible = false;
      return { died: false, headshot, blocked: true };
    }
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = headshot ? 0.12 : 0.08;
    const archetype = ENEMY_ARCHETYPES[this.archetype];
    const baseStagger = (headshot ? 0.2 : 0.075) + Math.min(0.08, amount / 900);
    const bossMul = this.isBoss ? 0.3 : 1;
    const eliteMul = this.eliteAffix ? 0.65 : 1;
    this.staggerTimer = Math.max(this.staggerTimer, baseStagger * archetype.staggerMul * bossMul * eliteMul);
    if (headshot && this.archetype === "charger") {
      this.chargeWindup = 0;
      this.chargeTimer *= 0.35;
    }
    if (knock > 0) {
      // heavier enemies barely budge; overwrite (not add) so multi-pellet hits don't launch
      const mass = (this.isBoss ? 7 : archetype.mass) * (this.eliteAffix ? 1.4 : 1);
      const headshotBoost = headshot ? 1.45 : 1;
      this.knockX = kx * ((knock * headshotBoost) / mass);
      this.knockZ = kz * ((knock * headshotBoost) / mass);
    }
    this.updateHealthBar();
    if (this.health <= 0) {
      this.kill();
      return { died: true, headshot, blocked: false };
    }
    return { died: false, headshot, blocked: false };
  }

  kill() {
    // isBoss left intact so death handlers can detect a boss kill; reset on next spawn.
    this.alive = false;
    this.animationState = "death";
    this.animationStateTime = 0;
    this.animationBlend = 1;
    // Drop the impact flash before snapshotting. takeDamage sets hitFlash on the
    // lethal hit too, and updateRigReaction writes white-hot RGB straight into the
    // palette — so on any multi-hit kill the palette here holds the flash, not the
    // enemy's styling, and the corpse would settle glowing white.
    this.hitFlash = 0;
    if (this.flashApplied) {
      this.flashApplied = false;
      this.applyStyle(this.styleColor);
    }
    this.deathSnapshot = {
      kind: this.enemyKind(),
      x: this.group.position.x,
      y: this.group.position.y,
      z: this.group.position.z,
      groundY: this.groundHeight,
      yaw: this.group.rotation.y,
      scale: this.group.scale.x,
      palette: this.rig.palette,
    };
    this.shielded = false;
    this.shieldMesh.visible = false;
    this.tellMesh.visible = false;
    // The rig never plays the death clip itself: update() returns early once
    // `alive` is false, and the pool hands this enemy straight to the next spawn.
    // FxSystem stands a separate corpse rig up from the snapshot above and drives
    // the ragdoll there; this body goes underground so its hit meshes — which stay
    // in ctx.raycastTargets for the pool's lifetime, and which THREE's raycaster
    // tests regardless of `visible` — stop catching bullets.
    this.group.visible = false;
    this.group.position.y = -100;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  private updateHealthBar() {
    const frac = Math.max(0, this.health / this.maxHealth);
    this.healthFill.scale.x = frac;
    this.healthFill.position.x = -(HEALTHBAR_WIDTH / 2) * (1 - frac);
    const mat = this.healthFill.material as THREE.MeshBasicMaterial;
    if (this.isBoss) mat.color.setHex(0xff2d55);
    else mat.color.setHex(frac > 0.45 ? 0xff6a00 : 0xc1121f);
    this.healthBarGroup.visible = this.isBoss || frac < 0.999;
  }

  dispose() {
    disposeEnemyRig(this.rig);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.dispose();
          });
        } else mat.dispose();
      }
    });
  }
}
