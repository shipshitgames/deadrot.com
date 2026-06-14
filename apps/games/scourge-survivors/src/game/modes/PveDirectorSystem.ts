import { type SpawnDescriptor, WaveDirector } from "@deadrot/game-kit/modes";
import type * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import {
  BOSS_ATTACK_DAMAGE,
  BOSS_ATTACK_INTERVAL,
  BOSS_ATTACK_RANGE,
  BOSS_COLOR,
  BOSS_HEALTH,
  BOSS_PROJECTILE_DAMAGE,
  BOSS_PROJECTILE_SPEED,
  BOSS_RESERVE_BONUS,
  BOSS_SCALE,
  BOSS_SCORE,
  BOSS_SPEED,
  ELITE_AFFIXES,
  ENEMY_MAX_HEALTH,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED,
  ENEMY_SCORE,
  ENEMY_SPEED_MAX,
  ENEMY_SPEED_MIN,
  FIRST_WAVE_DELAY,
  REAPER_SCORE,
  SCOURGE_WAVE_SCHEDULE,
  STAGE_DIFFICULTY_STEP,
  WAVE_BREAK,
  WAVE_SPAWN_INTERVAL,
  type WaveConfig,
  WEAPONS,
} from "../constants";
import type { GameContext } from "../context";
import { rollEliteSplitCount } from "../data/eliteWaves";
import { campaignArchetypeForWave, ENEMY_ARCHETYPES, SCOURGE_THREAT_TIERS } from "../data/enemies";
import { SURV_XP_GEM_VALUE } from "../data/survivors";
import { Enemy } from "../entities/Enemy";
import type { GameSystems } from "../systems";

export class PveDirectorSystem {
  // Boss state stays game-side: spawning, death, and HUD reads are Scourge-specific.
  bossActive = false;
  bossEnemy: Enemy | null = null;
  bossMaxHealth = BOSS_HEALTH;
  /** Lore-given name for the HUD boss bar (Survivors toll); null → generic banner. */
  bossName: string | null = null;

  /**
   * Genre-neutral wave pacing lives in the shared director; this system is its
   * Scourge host — it owns enemy spawning, the breach boss, and the economy,
   * and lets the director drive timing, the stagger gate, and wave progress.
   */
  private readonly director: WaveDirector<WaveConfig>;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {
    this.director = new WaveDirector<WaveConfig>(
      SCOURGE_WAVE_SCHEDULE,
      { firstWaveDelay: FIRST_WAVE_DELAY, waveBreak: WAVE_BREAK, spawnInterval: WAVE_SPAWN_INTERVAL },
      {
        aliveCount: () => this.ctx.aliveCount,
        spawn: (descriptor) => this.spawnWaveEnemy(descriptor),
        startBoss: () => {
          this.bossActive = true;
          this.sys.hud.announce(SCOURGE_THREAT_TIERS.breachBoss.banner);
          this.spawnBoss();
        },
        onWaveStart: (waveNumber) => this.sys.hud.announce(`WAVE ${waveNumber}`),
        onWaveCleared: (cleared, total) =>
          this.sys.hud.announce(cleared >= total ? "FINAL WAVE CLEARED" : `WAVE ${cleared} CLEARED`),
      },
    );
  }

  /** 1-based-friendly read of the active wave index (HUD + spawn tuning). */
  get waveIndex(): number {
    return this.director.waveIndex;
  }

  startWaveSystem() {
    for (const e of this.ctx.enemies) e.kill();
    this.director.reset();
    this.bossActive = false;
    this.bossEnemy = null;
    this.bossName = null;
  }

  /** Freeze wave progression when an outside authority (e.g. a co-op room) owns pacing. */
  suspendWaves() {
    this.director.suspend();
  }

  updateWaves(delta: number) {
    this.director.update(delta);
  }

  /** Per-stage difficulty scalar for the structured descent (1.0 on stage 1, no effect elsewhere). */
  stageMul(): number {
    return 1 + STAGE_DIFFICULTY_STEP * this.ctx.campaignStage;
  }

  spawnWaveEnemy(descriptor: SpawnDescriptor<WaveConfig>) {
    const wave = descriptor.plan.meta;
    const enemy = this.getFreeEnemy();
    const pt = this.sys.player.randomSpawnPoint();
    const arch = campaignArchetypeForWave(descriptor.waveIndex, descriptor.ordinal, this.ctx.campaignStage);
    enemy.spawnAt(pt.x, pt.z, {
      maxHealth: ENEMY_MAX_HEALTH * wave.healthMul * this.stageMul() * arch.hpMul,
      speed: (ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN)) * wave.speedMul * arch.speedMul,
      archetype: arch.id,
      color: arch.color,
      scale: arch.scale,
      ranged: arch.ranged,
      flying: arch.flying,
      hoverHeight: arch.hoverHeight,
      attackDamage: arch.attackDamage,
      projectileDamage: arch.projectileDamage ?? ENEMY_PROJECTILE_DAMAGE,
      projectileSpeed: ENEMY_PROJECTILE_SPEED,
    });
  }

  spawnBoss() {
    const enemy = this.getFreeEnemy();
    const pt = this.sys.player.randomSpawnPoint();
    const bossHp = BOSS_HEALTH * this.stageMul();
    enemy.spawnAt(pt.x, pt.z, {
      maxHealth: bossHp,
      isBoss: true,
      ranged: true,
      scale: BOSS_SCALE,
      speed: BOSS_SPEED,
      color: BOSS_COLOR,
      archetype: "tank",
      attackDamage: BOSS_ATTACK_DAMAGE,
      attackInterval: BOSS_ATTACK_INTERVAL,
      attackRange: BOSS_ATTACK_RANGE,
      projectileDamage: BOSS_PROJECTILE_DAMAGE,
      projectileSpeed: BOSS_PROJECTILE_SPEED,
    });
    this.bossEnemy = enemy;
    this.bossMaxHealth = bossHp;
    this.bossName = null; // campaign breach-boss keeps the generic banner (HUD falls back)
  }

  getFreeEnemy(): Enemy {
    let e = this.ctx.enemies.find((en) => !en.alive);
    if (!e) {
      e = new Enemy();
      this.ctx.scene.add(e.group);
      this.ctx.enemies.push(e);
      this.ctx.raycastTargets.push(...e.hitMeshes);
    }
    return e;
  }

  onEnemyDeath(enemy: Enemy, headshot: boolean) {
    const wasBoss = enemy.isBoss;
    const deathPos = enemy.position.clone();
    const deathScale = enemy.isBoss ? 2.4 : Math.max(0.8, enemy.group.scale.x);
    const deathFx = enemy.deathFx();
    const spec = WEAPONS[this.ctx.activeWeapon];
    this.ctx.kills++;
    // a dead mob's in-flight projectiles should fizzle out
    this.sys.projectiles.removeProjectilesFrom(enemy);

    // kill-streak combo + a combo-pitched kill sound (every kill source funnels
    // through here: gun, melee, cannon splash, and the Survivors auto-weapons).
    const combo = this.sys.fx.registerKill();
    audio.sfx("kill", { pitch: 1 + Math.min(combo - 1, 24) * 0.028 });
    if (combo === 5 || combo === 10 || combo === 20 || combo === 30 || (combo > 30 && combo % 25 === 0)) {
      audio.sfx("combo", { pitch: 1 + Math.min(combo, 50) * 0.008 });
    }
    if (wasBoss) {
      this.ctx.bossKills++;
      this.sys.fx.addShake(0.45);
      this.sys.fx.hitstop(0.06);
      audio.sfx("explosion");
    }

    if (this.ctx.sandbox) {
      this.sys.hud.killSeq++;
      this.ctx.score += wasBoss ? 250 : 10;
      this.sys.fx.spawnEnemyDeath(deathPos, {
        headshot,
        elite: wasBoss,
        scale: wasBoss ? 1.8 : deathScale,
        color: wasBoss ? 0xff2d55 : 0xc1121f,
        spriteKind: deathFx.kind,
        spriteView: deathFx.view,
        spriteFlip: deathFx.flip,
      });
      if (wasBoss) {
        this.bossActive = false;
        this.bossEnemy = null;
      }
      return;
    }

    if (this.ctx.survivors) {
      // The toll itself: killing it seals the breach and ends the run, so it skips
      // the elite drop/XP economy entirely — the victory IS the reward. Identity is
      // the director-held reference (Survivors elites also carry isBoss).
      if (this.sys.survivors.isReaper(enemy)) {
        this.ctx.score += REAPER_SCORE;
        this.bossActive = false;
        this.bossEnemy = null;
        this.bossName = null;
        this.sys.survivors.reaper = null;
        this.sys.fx.spawnEnemyDeath(deathPos, {
          headshot,
          elite: true,
          scale: 2.5,
          color: 0xff2d55,
          spriteKind: deathFx.kind,
          spriteView: deathFx.view,
          spriteFlip: deathFx.flip,
        });
        // Player-death-first ordering: if the run already ended this frame the
        // victory beat must not fire over the death screen.
        if (this.ctx.status !== "gameover") {
          this.sys.hud.showToast("BREACH SEALED");
          this.sys.gameOver.gameOver("win");
        }
        return;
      }
      const affixed = enemy.eliteAffix !== null;
      this.ctx.score += wasBoss ? 250 : 10;
      this.sys.fx.spawnEnemyDeath(deathPos, {
        headshot,
        elite: wasBoss || affixed,
        scale: wasBoss ? 1.8 : deathScale,
        color: wasBoss ? 0xff2d55 : enemy.eliteAffix ? ELITE_AFFIXES[enemy.eliteAffix].tint : 0xc1121f,
        spriteKind: deathFx.kind,
        spriteView: deathFx.view,
        spriteFlip: deathFx.flip,
      });
      this.sys.survivors.dropXpGem(deathPos.clone(), this.sys.survivors.enemyXp.get(enemy) ?? SURV_XP_GEM_VALUE);
      if (wasBoss) this.sys.survivors.onEliteKilled(deathPos.clone()); // Scourge elites also drop health + damage
      this.sys.survivors.onEnemyKilled(enemy, wasBoss);
      if (enemy.eliteAffix === "splitting") this.spawnEliteSplitChildren(enemy, deathPos);
      else this.spawnSplitterChildren(enemy, deathPos);
      // NOTE: no ammo on kill in Survivors — the sidearm is meant to run dry.
      return;
    }

    this.sys.hud.killSeq++;
    if (wasBoss) {
      this.ctx.score += BOSS_SCORE;
      this.ctx.reserve = Math.min(spec.reserveCap, this.ctx.reserve + BOSS_RESERVE_BONUS);
      this.sys.fx.spawnEnemyDeath(deathPos, {
        headshot,
        elite: true,
        scale: 2.5,
        color: 0xff2d55,
        spriteKind: deathFx.kind,
        spriteView: deathFx.view,
        spriteFlip: deathFx.flip,
      });
      this.bossActive = false;
      this.bossEnemy = null;
      this.sys.mission.onBossDefeated();
    } else {
      this.ctx.score += ENEMY_SCORE + (headshot ? 50 : 0);
      this.ctx.reserve = Math.min(spec.reserveCap, this.ctx.reserve + spec.ammoPerKill);
      this.sys.fx.spawnEnemyDeath(deathPos, {
        headshot,
        scale: deathScale,
        color: headshot ? 0xff415f : 0xc1121f,
        spriteKind: deathFx.kind,
        spriteView: deathFx.view,
        spriteFlip: deathFx.flip,
      });
      // a campaign kill counts toward clearing the active wave
      this.director.notifyProgress();
      this.sys.pickups.maybeDropPickup(enemy.position);
      this.spawnSplitterChildren(enemy, deathPos);
    }
  }

  private spawnSplitterChildren(parent: Enemy, pos: THREE.Vector3) {
    if (parent.isBoss || parent.archetype !== "splitter" || parent.splitCount <= 0) return;
    const count = Math.min(parent.splitCount, this.splitChildHeadroom());
    if (count <= 0) return;
    this.spawnSplitChildren(parent, pos, count);
    this.sys.hud.showToast("SPLITTER BROOD");
  }

  /** A dying "splitting" elite sheds standard enemies, capped per elite wave to avoid runaway. */
  private spawnEliteSplitChildren(parent: Enemy, pos: THREE.Vector3) {
    const desired = Math.min(rollEliteSplitCount(Math.random), this.splitChildHeadroom());
    const count = this.sys.survivors.takeEliteSplitAllowance(desired);
    if (count <= 0) return;
    this.spawnSplitChildren(parent, pos, count);
    this.sys.hud.showToast("ELITE BROOD");
  }

  private splitChildHeadroom(): number {
    return this.ctx.survivors ? Math.max(0, 72 - this.ctx.aliveCount) : 4;
  }

  private spawnSplitChildren(parent: Enemy, pos: THREE.Vector3, count: number) {
    const childDef = ENEMY_ARCHETYPES.swarmling;
    for (let i = 0; i < count; i++) {
      const child = this.getFreeEnemy();
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.45;
      const r = 0.8 + Math.random() * 0.9;
      child.spawnAt(
        Math.max(this.ctx.bounds.minX + 1.5, Math.min(this.ctx.bounds.maxX - 1.5, pos.x + Math.cos(a) * r)),
        Math.max(this.ctx.bounds.minZ + 1.5, Math.min(this.ctx.bounds.maxZ - 1.5, pos.z + Math.sin(a) * r)),
        {
          maxHealth: Math.max(10, parent.maxHealth * 0.18),
          speed: Math.max(parent.speed * 1.35, 3.2),
          archetype: childDef.id,
          color: childDef.color,
          scale: 0.7,
          attackDamage: Math.max(4, childDef.attackDamage - 1),
          flying: childDef.flying,
          hoverHeight: childDef.hoverHeight,
        },
      );
      if (this.ctx.survivors) this.sys.survivors.enemyXp.set(child, 1);
    }
  }

  updateEnemies(delta: number, elapsed: number) {
    let damageToPlayer = 0;
    const playerPos = this.ctx.body.position;
    const billboardQuat = this.ctx.camera.quaternion;
    for (const enemy of this.ctx.enemies) {
      if (!enemy.alive) continue;
      const tick = enemy.update(delta, elapsed, playerPos, this.ctx.enemies, billboardQuat, this.ctx.bounds);
      damageToPlayer += tick.melee;
      for (const shot of tick.shots) this.sys.projectiles.spawnProjectile(shot, enemy);
      this.sys.player.pushOutOfObstacles(enemy.position, enemy.radius);
    }
    if (damageToPlayer > 0) this.sys.player.damagePlayer(damageToPlayer);
  }
}
