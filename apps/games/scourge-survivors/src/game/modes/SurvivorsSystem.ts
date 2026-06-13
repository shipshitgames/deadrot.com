import * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import {
  ELITE_FRENZY_DAMAGE_MUL,
  ELITE_FRENZY_SPEED_MUL,
  ELITE_HP_MUL,
  ELITE_SCALE_MUL,
  ELITE_SHIELD_HP,
  ELITE_SPLIT_CAP_PER_WAVE,
  type EliteAffixDef,
  WEAPONS,
} from "../constants";
import type { GameContext } from "../context";
import { eliteCountForWave, eliteXpValue, planSurge, rollEliteAffix, takeSplitAllowance } from "../data/eliteWaves";
import { pickWeightedEnemyArchetype, SCOURGE_THREAT_TIERS } from "../data/enemies";
import { DEFAULT_MAP_ID, getMap, normalizeMapId } from "../data/maps";
import {
  AMP_PER_TIER,
  availableEvolutionChoice,
  BANISHES_PER_RUN,
  MAIN_WEAPON_TIER_LABEL,
  mainWeaponTierIndex,
  type MainWeaponVisualTier,
  mainWeaponVisualTier,
  REROLLS_PER_LEVEL,
  SURV_BASE_MAGNET,
  SURV_ELITE_INTERVAL,
  SURV_ENEMY_BASE_HP,
  SURV_SPAWN_CAP,
  SURV_SPAWN_MIN,
  SURV_SPAWN_START,
  SURV_SWELL_CAP,
  SURV_SWELL_COUNT,
  SURV_SWELL_INTERVAL,
  SURV_XP_ELITE_VALUE,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_CHAPTERS,
  SURVIVOR_RUN_GOAL_TIME,
  type SurvArchetype,
  type SurvivorClassId,
  survivorBuildList,
  survivorChapterAt,
  survivorChapterStart,
  survivorClassFor,
  survivorStartingWeapon,
  UPGRADE_BY_ID,
  UPGRADES,
  type UpgradeId,
  WEAPON_UPGRADE_IDS,
  type WeaponUpgradeId,
  xpForLevel,
} from "../data/survivors";
import type { Enemy } from "../entities/Enemy";
import { XP_BLOOD_SCALE, XP_BLOOD_TEXTURE } from "../spriteAssets";
import type { GameSystems } from "../systems";
import type { BuildEntry, UpgradeChoice } from "../types";
import { SurvivorsAutoWeapons } from "./SurvivorsAutoWeapons";

const DEFENSIVE_UPGRADES: UpgradeId[] = [
  "maxhp",
  "regen",
  "armor",
  "ward",
  "spikes",
  "bloodtap",
  "bastion",
  "dodge",
  "grace",
];

export class SurvivorsSystem {
  level = 1;
  xp = 0;
  xpToNext = xpForLevel(1);
  pendingLevels = 0;
  // A tier-up earned during a draft is announced only once the draft closes and the run
  // resumes, so the centre banner never fires behind the (occluding) level-up overlay (#279).
  pendingTierAnnounce: MainWeaponVisualTier | null = null;
  choices: UpgradeChoice[] = [];
  upgradeLevels: Partial<Record<UpgradeId, number>> = {};
  aw: SurvivorsAutoWeapons;
  survSpawnTimer = 0;
  survClock = 0;
  eliteTimer = SURV_ELITE_INTERVAL;
  swellTimer = SURV_SWELL_INTERVAL; // next breach-surge horde swell
  surgeIndex = 0; // 1-based count of breach surges fired this run (drives elite cadence)
  eliteSplitBudget = 0; // split children remaining for the current elite wave
  xpGems: { sprite: THREE.Sprite; value: number; age: number }[] = [];
  enemyXp = new WeakMap<Enemy, number>();
  shopTiers: Record<string, number> = {}; // permanent meta-upgrades

  // --- draft agency + build identity ---
  selectedClass: SurvivorClassId = "ranger";
  /** Breach site picked on the pre-run map select — holds for the whole run (#276). */
  selectedMapId: string = DEFAULT_MAP_ID;
  rerolls = 0; // free re-rolls remaining for the open draft
  banishes = 0; // banishes remaining this run
  banished = new Set<UpgradeId>(); // upgrades removed from this run's pool
  evolved: Record<WeaponUpgradeId, boolean> = { orbit: false, bolt: false, nova: false };
  statAmp = 1; // 'amp' (Cauterizer Feed) auto-weapon damage multiplier
  bastionTimer = 0;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {
    this.aw = new SurvivorsAutoWeapons(ctx, (enemy, dmg) => this.autoDamageEnemy(enemy, dmg));
  }

  init() {
    this.aw.init();
  }

  startSurvivors(classId: SurvivorClassId = this.selectedClass, mapId: string = this.selectedMapId) {
    this.sys.multiplayer.leaveMultiplayer(false);
    this.sys.mission.clearMissionState();
    this.selectedClass = survivorClassFor(classId).id;
    this.ctx.survivorClassId = this.selectedClass;
    this.selectedMapId = normalizeMapId(mapId);
    this.ctx.survivors = true;
    this.ctx.campaignStage = 0;
    this.sys.arena.buildArena(getMap(this.selectedMapId));
    this.sys.player.resetPlayer(survivorStartingWeapon(this.selectedClass));
    this.initSurvivorsRun();
    this.ctx.status = "pointerlock-needed";
    this.sys.hud.emit();
    this.sys.input.requestLock();
  }

  initSurvivorsRun() {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.pendingLevels = 0;
    this.pendingTierAnnounce = null;
    this.choices = [];
    this.upgradeLevels = {};
    this.banishes = BANISHES_PER_RUN;
    this.banished.clear();
    this.evolved = { orbit: false, bolt: false, nova: false };
    this.rerolls = 0;
    this.bastionTimer = 0;
    this.ctx.survivorChapter = 0;
    this.ctx.survivorTotalChapters = SURVIVOR_RUN_CHAPTERS.length;
    this.ctx.survivorGoalTime = SURVIVOR_RUN_GOAL_TIME;
    const cls = SURVIVOR_CLASSES[this.ctx.survivorClassId];
    for (const [id, level] of Object.entries(cls.startingUpgrades ?? {}) as [UpgradeId, number][]) {
      this.upgradeLevels[id] = Math.max(this.upgradeLevels[id] ?? 0, level);
    }
    if ((this.shopTiers.arsenal ?? 0) > 0) this.upgradeLevels.orbit = Math.max(this.upgradeLevels.orbit ?? 0, 1); // Arsenal perk
    if ((this.shopTiers.munitions ?? 0) > 0) this.upgradeLevels.bolt = Math.max(this.upgradeLevels.bolt ?? 0, 1); // Munitions perk
    if ((this.shopTiers.pulsar ?? 0) > 0) this.upgradeLevels.nova = Math.max(this.upgradeLevels.nova ?? 0, 1); // Pulsar perk
    this.survSpawnTimer = 0.25;
    this.survClock = 0;
    this.eliteTimer = this.currentChapter().eliteInterval;
    this.swellTimer = this.currentChapter().swellInterval;
    this.surgeIndex = 0;
    this.eliteSplitBudget = 0;
    this.aw.resetTimers();
    this.ctx.damageGraceTimer = 0;
    for (const e of this.ctx.enemies) e.kill();
    this.clearSurvivorsEntities();
    this.recomputeStats();
    this.ctx.health = this.ctx.maxHealthValue;
    this.ctx.statShield = this.ctx.statShieldMax;
    // Survivors: infinite RESERVE but a real magazine — you still reload (the
    // weapon's fire/reload cadence is part of the challenge), you just never run dry.
    this.ctx.ammo = WEAPONS[this.ctx.activeWeapon].magazineSize;
    this.ctx.reserve = 0; // unused in Survivors (reload ignores reserve); shown as ∞
    this.ctx.reloading = false;
  }

  mainWeaponVisualTier() {
    return mainWeaponVisualTier(this.upgradeLevels);
  }

  clearSurvivorsEntities() {
    this.clearXpGems();
    this.aw.clear();
  }

  clearXpGems() {
    for (const g of this.xpGems) {
      this.ctx.scene.remove(g.sprite);
      g.sprite.material.dispose();
    }
    this.xpGems = [];
  }

  /** Apply persistent shop tiers (called by React with the saved meta-progression). */
  setShopUpgrades(tiers: Record<string, number>) {
    this.shopTiers = tiers || {};
    if (this.ctx.survivors) this.recomputeStats();
  }

  selectedStartingWeapon() {
    return survivorStartingWeapon(this.selectedClass);
  }

  setSurvivorClass(classId: SurvivorClassId) {
    if (!SURVIVOR_CLASSES[classId]) return;
    this.selectedClass = classId;
    this.ctx.survivorClassId = classId;
    if (this.ctx.survivors) this.recomputeStats();
  }

  currentChapter() {
    return SURVIVOR_RUN_CHAPTERS[this.ctx.survivorChapter] ?? SURVIVOR_RUN_CHAPTERS[0];
  }

  currentChapterProgress(): number {
    const start = survivorChapterStart(this.ctx.survivorChapter);
    const chapter = this.currentChapter();
    return Math.max(0, Math.min(1, (this.survClock - start) / chapter.duration));
  }

  recomputeStats() {
    if (!this.ctx.survivors) {
      this.ctx.statDamageMul = 1;
      this.ctx.statFireRateMul = 1;
      this.ctx.statMoveMul = 1;
      this.ctx.statMaxHpBonus = 0;
      this.ctx.statRegen = 0;
      this.ctx.statMagnet = SURV_BASE_MAGNET;
      this.ctx.statXpMul = 1;
      this.ctx.statCrit = 0;
      this.ctx.statMultishot = 0;
      this.ctx.statArmor = 0;
      this.ctx.statShieldMax = 0;
      this.ctx.statShield = 0;
      this.ctx.statShieldRegen = 0;
      this.ctx.statRetaliate = 0;
      this.ctx.statKillHeal = 0;
      this.ctx.statBastion = 0;
      this.ctx.statDodge = 0;
      this.ctx.statGrace = 0;
      this.ctx.damageGraceTimer = 0;
      this.statAmp = 1;
      return;
    }

    const lv = (id: UpgradeId) => this.upgradeLevels[id] ?? 0;
    const sh = (id: string) => this.shopTiers[id] ?? 0;
    const cls = SURVIVOR_CLASSES[this.ctx.survivorClassId] ?? SURVIVOR_CLASSES.ranger;
    const prevShieldMax = this.ctx.statShieldMax;
    this.ctx.statDamageMul = (cls.damageMul ?? 1) * (1 + 0.25 * lv("dmg")) * (1 + 0.08 * sh("might"));
    this.ctx.statFireRateMul = (cls.fireRateMul ?? 1) * (1 + 0.18 * lv("rate"));
    this.ctx.statMoveMul = (cls.moveMul ?? 1) * (1 + 0.12 * lv("speed")) * (1 + 0.06 * sh("swift"));
    this.ctx.statMaxHpBonus = (cls.maxHpBonus ?? 0) + 30 * lv("maxhp") + 18 * sh("vigor");
    this.ctx.statRegen = (cls.regen ?? 0) + 2 * lv("regen") + 0.8 * sh("regenP");
    this.ctx.statMagnet =
      SURV_BASE_MAGNET * (cls.magnetMul ?? 1) * (1 + 0.45 * lv("magnet")) * (1 + 0.24 * sh("magnetP"));
    this.ctx.statXpMul = (cls.xpMul ?? 1) * (1 + 0.2 * lv("xpgain")) * (1 + 0.12 * sh("scholar"));
    this.ctx.statCrit = (cls.crit ?? 0) + 0.12 * lv("crit");
    this.ctx.statMultishot = lv("multishot");
    this.ctx.statArmor = Math.min(0.72, (cls.armor ?? 0) + 0.1 * lv("armor"));
    this.ctx.statShieldMax = Math.max(0, (cls.shieldMax ?? 0) + 24 * lv("ward"));
    this.ctx.statShieldRegen = (cls.shieldRegen ?? 0) + 2.4 * lv("ward");
    this.ctx.statRetaliate = (cls.retaliate ?? 0) + 14 * lv("spikes");
    this.ctx.statKillHeal = (cls.killHeal ?? 0) + 0.9 * lv("bloodtap");
    this.ctx.statBastion = lv("bastion");
    this.ctx.statDodge = Math.min(0.42, 0.08 * lv("dodge"));
    this.ctx.statGrace = 0.24 * lv("grace");
    if (this.ctx.statShieldMax > prevShieldMax) {
      this.ctx.statShield = Math.min(
        this.ctx.statShieldMax,
        this.ctx.statShield + (this.ctx.statShieldMax - prevShieldMax),
      );
    } else {
      this.ctx.statShield = Math.min(this.ctx.statShield, this.ctx.statShieldMax);
    }
    this.statAmp = 1 + AMP_PER_TIER * lv("amp"); // synergy: buffs the 3 auto-weapons
    this.aw.recompute({ orbit: lv("orbit"), bolt: lv("bolt"), nova: lv("nova") }, this.evolved, this.ctx.statMultishot);
  }

  gainXp(v: number) {
    this.xp += v * this.ctx.statXpMul;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      this.pendingLevels++;
      leveled = true;
    }
    if (leveled && this.ctx.status === "playing") this.triggerLevelUp();
  }

  triggerLevelUp() {
    this.ctx.status = "levelup";
    this.rerolls = REROLLS_PER_LEVEL;
    this.rollChoices();
    if (this.ctx.rig.captured) this.ctx.rig.releaseCapture();
    audio.sfx("levelup"); // dedicated rising fanfare — the best beat in the mode
    this.sys.hud.emit();
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** A golden evolution card when a weapon AND its paired passive are both maxed. */
  private availableEvolutionCard(): UpgradeChoice | null {
    return availableEvolutionChoice(this.upgradeLevels, this.evolved);
  }

  rollChoices() {
    const evoCard = this.availableEvolutionCard();
    const eligible = this.shuffle(
      UPGRADES.filter((u) => (this.upgradeLevels[u.id] ?? 0) < u.max && !this.banished.has(u.id)),
    );
    // Early-run bias: if you own no auto-weapon yet, float one to the front so
    // runs reach a build instead of whiffing on passives.
    const ownsWeapon = WEAPON_UPGRADE_IDS.some((w) => (this.upgradeLevels[w] ?? 0) > 0);
    if (!ownsWeapon) {
      const wi = eligible.findIndex((u) => u.kind === "weapon");
      if (wi > 0) eligible.unshift(eligible.splice(wi, 1)[0]);
    }
    const slots = evoCard ? 2 : 3;
    const needsDefensiveChoice =
      this.level <= 5 ||
      this.ctx.health / this.ctx.maxHealthValue <= 0.58 ||
      !DEFENSIVE_UPGRADES.some((id) => (this.upgradeLevels[id] ?? 0) > 0);
    if (needsDefensiveChoice && !eligible.slice(0, slots).some((u) => DEFENSIVE_UPGRADES.includes(u.id))) {
      const di = eligible.findIndex((u) => DEFENSIVE_UPGRADES.includes(u.id));
      if (di >= slots) eligible.splice(slots - 1, 0, eligible.splice(di, 1)[0]);
    }
    const picks: UpgradeChoice[] = eligible.slice(0, slots).map((u) => ({
      id: u.id,
      name: u.name,
      desc: u.desc,
      icon: u.icon,
      level: this.upgradeLevels[u.id] ?? 0,
      max: u.max,
    }));
    this.choices = evoCard ? [evoCard, ...picks] : picks;
  }

  /** Re-draw the current draft (spends a free re-roll). */
  reroll() {
    if (this.ctx.status !== "levelup" || this.rerolls <= 0) return;
    this.rerolls--;
    this.rollChoices();
    audio.sfx("switch");
    this.sys.hud.emit();
  }

  /** Permanently remove an upgrade from this run's pool and re-draw (spends a banish). */
  banish(id: string) {
    if (this.ctx.status !== "levelup" || this.banishes <= 0) return;
    if (id.startsWith("evo-")) return; // evolutions can't be banished
    const uid = id as UpgradeId;
    if (!UPGRADE_BY_ID[uid] || this.banished.has(uid)) return;
    this.banished.add(uid);
    this.banishes--;
    this.rollChoices();
    audio.sfx("switch");
    this.sys.hud.emit();
  }

  /** Called from the React draft UI when a card is chosen. */
  pickUpgrade(id: string) {
    if (this.ctx.status !== "levelup") return;
    const previousMainWeaponTier = this.mainWeaponVisualTier();
    if (id.startsWith("evo-")) {
      const w = id.slice(4) as WeaponUpgradeId;
      if (WEAPON_UPGRADE_IDS.includes(w) && !this.evolved[w]) {
        this.evolved[w] = true;
        this.recomputeStats();
        audio.sfx("victory"); // the climax beat
      }
    } else {
      const uid = id as UpgradeId;
      if (UPGRADE_BY_ID[uid]) {
        const prev = this.upgradeLevels[uid] ?? 0;
        this.upgradeLevels[uid] = prev + 1;
        this.recomputeStats();
        if (uid === "maxhp") this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + 30);
        if (uid === "ward") this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 24);
        audio.sfx("pickup");
      }
    }
    // Every weapon re-applies its model on a tier change so the TIER_SCALE growth (and any
    // future per-tier art) lands; the per-frame TIER_GLOW tint tracks the tier on its own.
    const nextMainWeaponTier = this.mainWeaponVisualTier();
    if (nextMainWeaponTier !== previousMainWeaponTier) {
      this.sys.weapon.applyWeaponModel(this.ctx.activeWeapon);
      // A tier-up is a run reward (#279): queue the unmissable centre banner + power-cue, but
      // defer firing it until the draft closes (below) so it never plays behind the level-up
      // overlay. Chained picks collapse to one banner for the highest tier reached.
      if (mainWeaponTierIndex(nextMainWeaponTier) > mainWeaponTierIndex(previousMainWeaponTier)) {
        this.pendingTierAnnounce = nextMainWeaponTier;
      }
    }
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) {
      this.rerolls = REROLLS_PER_LEVEL;
      this.rollChoices();
      this.sys.hud.emit();
    } else {
      this.choices = [];
      this.ctx.status = "playing";
      this.flushTierAnnounce();
      this.sys.hud.emit();
      this.sys.input.requestLock();
    }
  }

  /** Fire any tier-up banner queued during the draft, now that the run has resumed (#279). */
  private flushTierAnnounce() {
    if (!this.pendingTierAnnounce) return;
    this.sys.hud.announce(`WEAPON ${MAIN_WEAPON_TIER_LABEL[this.pendingTierAnnounce]}`);
    audio.sfx("berserk");
    this.pendingTierAnnounce = null;
  }

  updateSurvivors(delta: number) {
    this.survClock += delta;
    this.updateStructuredRun();
    if (this.ctx.status !== "playing") return;
    if (this.bastionTimer > 0) this.bastionTimer = Math.max(0, this.bastionTimer - delta);
    if (this.ctx.damageGraceTimer > 0) this.ctx.damageGraceTimer = Math.max(0, this.ctx.damageGraceTimer - delta);

    // regen
    if (this.ctx.statRegen > 0 && this.ctx.health > 0) {
      this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + this.ctx.statRegen * delta);
    }
    if (this.ctx.statShieldMax > 0 && this.ctx.health > 0) {
      this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + this.ctx.statShieldRegen * delta);
    }

    // escalating swarm spawns
    this.survSpawnTimer -= delta;
    const chapter = this.currentChapter();
    const interval = Math.max(SURV_SPAWN_MIN, (SURV_SPAWN_START - this.survClock * 0.01) / chapter.spawnMul);
    const cap = Math.round(SURV_SPAWN_CAP * chapter.capMul);
    if (this.survSpawnTimer <= 0 && this.ctx.aliveCount < cap) {
      this.spawnSwarmEnemy(false);
      this.survSpawnTimer = interval;
    }
    this.eliteTimer -= delta;
    if (this.eliteTimer <= 0) {
      this.sys.hud.announce(SCOURGE_THREAT_TIERS.elite.banner); // telegraph the beat (was a silent spawn)
      audio.sfx("boss");
      this.spawnSwarmEnemy(true);
      this.eliteTimer = chapter.eliteInterval;
    }

    // Horde swells: a sudden wall of fodder so the curve pulses instead of
    // creeping linearly — the "oh no" moment that forces you onto your build.
    this.swellTimer -= delta;
    if (this.swellTimer <= 0) {
      this.swellTimer = chapter.swellInterval;
      this.triggerSwell();
    }

    this.aw.update(delta, this.survClock);
    this.updateXpGems(delta);
  }

  private updateStructuredRun() {
    if (this.survClock >= SURVIVOR_RUN_GOAL_TIME) {
      this.sys.hud.announce("BREACH SEALED");
      this.sys.gameOver.gameOver("win");
      return;
    }

    const nextChapter = survivorChapterAt(this.survClock);
    if (nextChapter !== this.ctx.survivorChapter) this.advanceChapter(nextChapter);
  }

  /**
   * Chapter advances are pacing beats on a fixed arena — the picked map never
   * changes mid-run (#276). The fight keeps flowing (no wipe, no teleport);
   * the small heal/shield refund is the breather as the pressure steps up.
   */
  private advanceChapter(index: number) {
    const chapter = SURVIVOR_RUN_CHAPTERS[index];
    if (!chapter) return;
    this.ctx.survivorChapter = index;
    this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + 32);
    this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 24);
    this.eliteTimer = Math.min(this.eliteTimer, chapter.eliteInterval);
    this.swellTimer = Math.min(this.swellTimer, chapter.swellInterval);
    this.sys.hud.announce(`${index + 1}/${SURVIVOR_RUN_CHAPTERS.length} · ${chapter.name.toUpperCase()}`);
    audio.sfx("breach");
  }

  /** A point on a ring around the player, just out of immediate sight, clamped in-bounds. */
  private swarmSpawnPoint(): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 10;
    let x = this.ctx.body.position.x + Math.cos(a) * r;
    let z = this.ctx.body.position.z + Math.sin(a) * r;
    x = Math.max(this.ctx.bounds.minX + 2, Math.min(this.ctx.bounds.maxX - 2, x));
    z = Math.max(this.ctx.bounds.minZ + 2, Math.min(this.ctx.bounds.maxZ - 2, z));
    return { x, z };
  }

  /**
   * Shared spawn config for a swarm archetype: applies the time/chapter HP and
   * speed scaling once, with optional elite multipliers layered on top.
   */
  private swarmSpawnOptions(
    arch: SurvArchetype,
    {
      hpMul = 1,
      speedMul = 1,
      dmgMul = 1,
      scaleMul = 1,
      affix,
      overshield,
    }: {
      hpMul?: number;
      speedMul?: number;
      dmgMul?: number;
      scaleMul?: number;
      affix?: EliteAffixDef["id"];
      overshield?: number;
    } = {},
  ) {
    const chapter = this.currentChapter();
    const timeScale = (1 + this.survClock * 0.01) * chapter.hpMul; // HP scales with time + chapter
    const speedScale = (1 + this.survClock * 0.0035) * chapter.speedMul;
    return {
      maxHealth: SURV_ENEMY_BASE_HP * timeScale * arch.hpMul * hpMul,
      speed: (2.6 + Math.random() * 1.0) * arch.speedMul * speedScale * speedMul,
      archetype: arch.id,
      color: arch.color,
      scale: arch.scale * scaleMul,
      ranged: arch.ranged,
      flying: arch.flying,
      hoverHeight: arch.hoverHeight,
      attackDamage: Math.ceil(arch.attackDamage * dmgMul),
      projectileDamage: Math.ceil((arch.projectileDamage ?? 7) * dmgMul),
      eliteAffix: affix,
      overshield,
    };
  }

  spawnSwarmEnemy(elite: boolean) {
    const enemy = this.sys.pve.getFreeEnemy();
    const { x, z } = this.swarmSpawnPoint();

    if (elite) {
      const chapter = this.currentChapter();
      const timeScale = (1 + this.survClock * 0.01) * chapter.hpMul; // HP scales with time + chapter
      const speedScale = (1 + this.survClock * 0.0035) * chapter.speedMul;
      enemy.spawnAt(x, z, {
        maxHealth: SURV_ENEMY_BASE_HP * timeScale * 9,
        speed: 2.2 * speedScale,
        color: 0xff1f4f,
        isBoss: true,
        scale: 2.2,
        attackDamage: 16,
        projectileDamage: 7,
      });
      this.enemyXp.set(enemy, SURV_XP_ELITE_VALUE);
      return;
    }

    const arch = this.rollArchetype();
    enemy.spawnAt(x, z, this.swarmSpawnOptions(arch));
    this.enemyXp.set(enemy, arch.xp);
  }

  /** Weighted archetype roll — fodder starts early, specials fold in as breach pressure rises. */
  private rollArchetype(): SurvArchetype {
    return pickWeightedEnemyArchetype(this.survClock, this.ctx.survivorChapter);
  }

  /** Burst-spawn a wall of fodder (ignores the steady cap up to SURV_SWELL_CAP). */
  private triggerSwell() {
    const plan = planSurge(this.surgeIndex, SURV_SWELL_CAP - this.ctx.aliveCount, SURV_SWELL_COUNT);
    this.surgeIndex = plan.nextSurgeIndex;
    // Arena already at the swell cap: skip the beat entirely — no banner, no
    // cues, and the elite cadence slot is preserved for the next surge that
    // can actually field enemies (the swell timer was already re-armed).
    if (plan.spawnCount <= 0) return;
    if (plan.elite) {
      this.triggerEliteWave(plan.spawnCount);
      return;
    }
    this.sys.hud.announce("BREACH SURGE");
    audio.sfx("wave");
    for (let i = 0; i < plan.spawnCount; i++) this.spawnSwarmEnemy(false);
  }

  /** Every Nth surge lands as an ELITE WAVE: one rolled affix shared by the whole batch. */
  private triggerEliteWave(spawnCount: number) {
    const affix = rollEliteAffix(Math.random);
    this.eliteSplitBudget = affix.id === "splitting" ? ELITE_SPLIT_CAP_PER_WAVE : 0;
    this.sys.hud.announce("ELITE WAVE");
    this.sys.hud.showToast(affix.name);
    audio.sfx("wave");
    if (affix.cue) audio.sfx(affix.cue); // once per elite batch, not per enemy
    const elites = eliteCountForWave(spawnCount);
    for (let i = 0; i < spawnCount; i++) {
      if (i < elites) this.spawnAffixedElite(affix);
      else this.spawnSwarmEnemy(false);
    }
  }

  /** Promoted spawn for an ELITE WAVE: bigger, tinted, affix-modified, triple gem value. */
  spawnAffixedElite(affix: EliteAffixDef) {
    const enemy = this.sys.pve.getFreeEnemy();
    const { x, z } = this.swarmSpawnPoint();
    const chapter = this.currentChapter();
    const timeScale = (1 + this.survClock * 0.01) * chapter.hpMul;
    const arch = this.rollArchetype();
    const frenzied = affix.id === "frenzied";
    enemy.spawnAt(
      x,
      z,
      this.swarmSpawnOptions(arch, {
        hpMul: ELITE_HP_MUL,
        speedMul: frenzied ? ELITE_FRENZY_SPEED_MUL : 1,
        dmgMul: frenzied ? ELITE_FRENZY_DAMAGE_MUL : 1,
        scaleMul: ELITE_SCALE_MUL,
        affix: affix.id,
        overshield: affix.id === "shielded" ? Math.round(ELITE_SHIELD_HP * timeScale) : 0,
      }),
    );
    this.enemyXp.set(enemy, eliteXpValue(arch.xp));
  }

  /** Spend split budget for a dying splitting elite (capped per elite wave). */
  takeEliteSplitAllowance(desired: number): number {
    const { allowed, remaining } = takeSplitAllowance(this.eliteSplitBudget, desired);
    this.eliteSplitBudget = remaining;
    return allowed;
  }

  /** Apply damage from an auto-weapon (handles death + XP, no crosshair marker). */
  autoDamageEnemy(enemy: Enemy, dmg: number) {
    if (!enemy.alive) return;
    const crit = this.ctx.statCrit > 0 && Math.random() < this.ctx.statCrit;
    // statAmp (Cauterizer Feed) + crit make a passive build empower the auto-weapons.
    const total = dmg * this.ctx.statDamageMul * this.statAmp * (crit ? 2 : 1);
    const res = enemy.takeDamage(total, false);
    if (res.blocked) {
      audio.sfx("shieldhit"); // elite overshield (or boss shield) ate the hit
      return;
    }
    this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.6), total, crit ? "crit" : "normal");
    this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.35), crit);
    if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
  }

  onPlayerDamaged(rawDamage: number, healthDamage: number) {
    if (rawDamage <= 0) return;
    if (this.ctx.statRetaliate > 0) {
      const px = this.ctx.body.position.x;
      const pz = this.ctx.body.position.z;
      const radius = 5.2;
      const dmg = this.ctx.statRetaliate + rawDamage * 0.6;
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive) continue;
        const dx = enemy.position.x - px;
        const dz = enemy.position.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > radius + enemy.radius) continue;
        const k = d > 0.001 ? 1 / d : 1;
        const res = enemy.takeDamage(dmg, false, 4, dx * k, dz * k);
        if (res.blocked) {
          audio.sfx("shieldhit"); // overshield ate the retaliation — no damage feedback
        } else {
          this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.5), dmg, "normal");
        }
        if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
      }
    }

    if (
      this.ctx.statBastion > 0 &&
      healthDamage > 0 &&
      this.ctx.health / this.ctx.maxHealthValue <= 0.42 &&
      this.bastionTimer <= 0
    ) {
      this.bastionTimer = Math.max(3.2, 8.2 - this.ctx.statBastion * 1.6);
      this.castBastionPulse();
    }
  }

  onEnemyKilled(_enemy: Enemy, elite: boolean) {
    if (this.ctx.statKillHeal > 0 && this.ctx.health > 0) {
      const heal = this.ctx.statKillHeal * (elite ? 5 : 1);
      this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + heal);
    }
  }

  private castBastionPulse() {
    this.sys.hud.announce("BASTION PULSE");
    audio.sfx("shieldUp");
    const center = this.ctx.body.position;
    this.aw.castRing({
      x: center.x,
      z: center.z,
      y: 0.22,
      innerRadius: 0.78,
      segments: 46,
      color: 0xffd166,
      opacity: 0.65,
      ttl: 0.45,
      dmg: 36 + this.ctx.statBastion * 24,
      maxR: 8 + this.ctx.statBastion * 1.6,
    });
    this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 12 + this.ctx.statBastion * 8);
    this.sys.fx.addShake(0.24);
  }

  /** Elites ("bosses") drop survival rewards on top of their big XP gem. */
  onEliteKilled(pos: THREE.Vector3) {
    this.sys.pickups.spawnPickup("health", pos.x + 1.2, pos.z);
    this.sys.pickups.spawnPickup("damage", pos.x - 1.2, pos.z);
  }

  dropXpGem(pos: THREE.Vector3, value: number) {
    const big = value > 1;
    const mat = new THREE.SpriteMaterial({
      map: XP_BLOOD_TEXTURE,
      color: big ? 0xffd166 : 0xffffff,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = big ? XP_BLOOD_SCALE[0] * 1.35 : XP_BLOOD_SCALE[0];
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(pos.x, 0.65, pos.z);
    sprite.userData = { baseScale: scale, baseY: 0.65 };
    this.ctx.scene.add(sprite);
    this.xpGems.push({ sprite, value, age: 0 });
  }

  updateXpGems(delta: number) {
    const px = this.ctx.body.position.x;
    const pz = this.ctx.body.position.z;
    for (let i = this.xpGems.length - 1; i >= 0; i--) {
      const g = this.xpGems[i];
      g.age += delta;
      g.sprite.material.rotation += delta * 2.5;
      g.sprite.position.y = 0.65 + Math.sin(g.age * 4) * 0.1;
      const pulse = 1 + Math.sin(g.age * 6) * 0.07;
      const baseScale = (g.sprite.userData.baseScale as number | undefined) ?? XP_BLOOD_SCALE[0];
      g.sprite.scale.set(baseScale * pulse, baseScale * pulse, 1);
      const d = Math.hypot(g.sprite.position.x - px, g.sprite.position.z - pz);
      if (d < this.ctx.statMagnet) {
        // magnet pull
        const pull = (1 - d / this.ctx.statMagnet) * 38 + 7;
        g.sprite.position.x += ((px - g.sprite.position.x) / (d || 1)) * pull * delta;
        g.sprite.position.z += ((pz - g.sprite.position.z) / (d || 1)) * pull * delta;
      }
      if (d < 1.6) {
        this.gainXp(g.value);
        this.ctx.scene.remove(g.sprite);
        g.sprite.material.dispose();
        this.xpGems.splice(i, 1);
      }
    }
  }

  /** Build summary for the HUD level-up / loadout panels. */
  buildList(): BuildEntry[] {
    return survivorBuildList(this.upgradeLevels, this.evolved);
  }
}
