import { type BalanceTelemetryClient, createBalanceTelemetry } from "@deadrot/game-kit/telemetry";
import type { GameContext } from "../context";
import { runGold, SHOP_BY_ID, type UpgradeId, type WeaponUpgradeId } from "../data/survivors";
import type { Enemy } from "../entities/Enemy";
import type { GameSystems } from "../systems";
import type { UpgradeChoice } from "../types";

export const SURVIVORS_TELEMETRY_TUNING_VERSION = "scourge-survivors.balance.v1";
export const SURVIVORS_CHECKPOINT_INTERVAL_SEC = 60;

const OFFENSIVE_UPGRADES = new Set<UpgradeId>(["dmg", "rate", "multishot", "crit", "amp", "orbit", "bolt", "nova"]);
const DEFENSIVE_UPGRADES = new Set<UpgradeId>([
  "maxhp",
  "regen",
  "armor",
  "ward",
  "spikes",
  "bloodtap",
  "bastion",
  "dodge",
  "grace",
]);

export type SurvivorChoiceCategory = "offensive" | "defensive" | "utility";
export type SurvivorChoiceState = "new" | "level-up" | "evolution" | "gold-conversion";

export interface SurvivorChoiceTelemetry {
  id: string;
  category: SurvivorChoiceCategory;
  current_level: number;
  max_level: number;
  state: SurvivorChoiceState;
}

export interface SurvivorBuildTelemetry {
  offensive: Array<{ id: string; level: number; evolved: boolean }>;
  defensive: Array<{ id: string; level: number; evolved: boolean }>;
  utility: Array<{ id: string; level: number; evolved: boolean }>;
}

interface EnemySpawnRollup {
  archetype: string;
  chapter: number;
  minute: number;
  elite: boolean;
  boss: boolean;
  count: number;
}

interface EnemyKillRollup {
  archetype: string;
  chapter: number;
  minute: number;
  elite: boolean;
  boss: boolean;
  damage_source: string;
  count: number;
  xp_total: number;
  lifetime_total_sec: number;
  lifetime_samples: number;
}

interface OutgoingDamageRollup {
  source: string;
  target_archetype: string;
  attempted: number;
  dealt: number;
  blocked: number;
}

interface IncomingDamageRollup {
  source: string;
  source_archetype: string;
  attempted: number;
  health_damage: number;
  mitigated: number;
  avoided: number;
}

interface IncomingPressureRollup {
  source: string;
  source_archetype: string;
  attempted: number;
}

export function survivorChoiceCategory(id: string): SurvivorChoiceCategory {
  const normalized = id.startsWith("evo-") ? (id.slice(4) as UpgradeId) : (id as UpgradeId);
  if (OFFENSIVE_UPGRADES.has(normalized)) return "offensive";
  if (DEFENSIVE_UPGRADES.has(normalized)) return "defensive";
  return "utility";
}

export function survivorChoiceTelemetry(choice: UpgradeChoice): SurvivorChoiceTelemetry {
  return {
    id: choice.id,
    category: survivorChoiceCategory(choice.id),
    current_level: choice.level,
    max_level: choice.max,
    state: choice.golden
      ? "evolution"
      : choice.id === "gold-conversion"
        ? "gold-conversion"
        : choice.level > 0
          ? "level-up"
          : "new",
  };
}

export function survivorBuildTelemetry(
  levels: Partial<Record<UpgradeId, number>>,
  evolved: Record<WeaponUpgradeId, boolean>,
): SurvivorBuildTelemetry {
  const build: SurvivorBuildTelemetry = { offensive: [], defensive: [], utility: [] };
  for (const [id, rawLevel] of Object.entries(levels) as [UpgradeId, number][]) {
    const level = Math.max(0, Math.floor(rawLevel));
    if (level <= 0) continue;
    build[survivorChoiceCategory(id)].push({
      id,
      level,
      evolved: id in evolved && evolved[id as WeaponUpgradeId],
    });
  }
  for (const entries of Object.values(build)) entries.sort((a, b) => a.id.localeCompare(b.id));
  return build;
}

export function warEffortTierFromDamageMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 1) return 0;
  return Math.max(0, Math.round((multiplier - 1) / 0.04));
}

/**
 * Run-scoped balance instrumentation for Survivors. It owns aggregation so hot
 * combat paths only increment in-memory counters; sinks receive bounded
 * rollups at checkpoints and run end.
 */
export class SurvivorsTelemetrySystem {
  private telemetry: BalanceTelemetryClient | null = null;
  private active = false;
  private nextCheckpointSec = SURVIVORS_CHECKPOINT_INTERVAL_SEC;
  private spawnRollups = new Map<string, EnemySpawnRollup>();
  private killRollups = new Map<string, EnemyKillRollup>();
  private outgoingDamage = new Map<string, OutgoingDamageRollup>();
  private incomingDamage = new Map<string, IncomingDamageRollup>();
  private incomingPressure = new Map<string, IncomingPressureRollup>();
  private enemySpawnedAt = new WeakMap<Enemy, number>();
  private lastDamageSource = new WeakMap<Enemy, string>();
  private lastIncomingSource = "unknown";
  private lastIncomingArchetype = "unknown";

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  startRun(): void {
    if (this.active) this.endRun("restarted");
    this.resetRunState();
    this.telemetry = createBalanceTelemetry({
      game: "scourge-survivors",
      mode: "survivors",
      tuningVersion: SURVIVORS_TELEMETRY_TUNING_VERSION,
    });
    this.active = true;
    this.telemetry.startRun({
      map_id: this.ctx.currentMap.id,
      class_id: this.ctx.survivorClassId,
      starting_weapon: this.ctx.activeWeapon,
      shop_tiers: this.shopTierSummary(),
      shop_tiers_owned: this.shopTierCount(),
      war_effort_tier: warEffortTierFromDamageMultiplier(this.ctx.warEffortDamageMul),
      war_effort_damage_multiplier: this.ctx.warEffortDamageMul,
      tuning_version: SURVIVORS_TELEMETRY_TUNING_VERSION,
    });
  }

  update(): void {
    if (!this.active || this.sys.survivors.survClock < this.nextCheckpointSec) return;
    this.checkpoint("interval");
    this.nextCheckpointSec =
      (Math.floor(this.sys.survivors.survClock / SURVIVORS_CHECKPOINT_INTERVAL_SEC) + 1) *
      SURVIVORS_CHECKPOINT_INTERVAL_SEC;
  }

  checkpoint(reason: "interval" | "chapter_boundary" | "test" = "interval"): void {
    if (!this.active || !this.telemetry) return;
    this.flushCombatRollups();
    this.telemetry.checkpoint(this.progressionPayload(reason), this.sys.survivors.survClock);
  }

  recordChoicesOffered(reason: "level_up" | "reroll" | "banish"): void {
    if (!this.active || !this.telemetry) return;
    this.telemetry.capture(
      "choice_offered",
      {
        level: this.sys.survivors.level,
        rerolls_remaining: this.sys.survivors.rerolls,
        banishes_remaining: this.sys.survivors.banishes,
        offer_reason: reason,
        choices: this.sys.survivors.choices.map(survivorChoiceTelemetry),
      },
      { elapsedSec: this.sys.survivors.survClock },
    );
  }

  recordChoicePicked(choice: UpgradeChoice, oldLevel: number, newLevel: number): void {
    if (!this.active || !this.telemetry) return;
    const build = this.currentBuild();
    this.telemetry.capture(
      "choice_picked",
      {
        ...survivorChoiceTelemetry(choice),
        old_level: oldLevel,
        new_level: newLevel,
        hit_max: newLevel >= choice.max,
        offensive_slot_count: build.offensive.length,
        defensive_slot_count: build.defensive.length,
        utility_slot_count: build.utility.length,
        weapon_tier: this.sys.survivors.mainWeaponVisualTier(),
      },
      { elapsedSec: this.sys.survivors.survClock },
    );
  }

  recordEnemySpawned(enemy: Enemy, phase?: "elite_spawn" | "reaper_spawn"): void {
    if (!this.active) return;
    const chapter = this.ctx.survivorChapter + 1;
    const minute = Math.floor(this.sys.survivors.survClock / 60);
    const elite = enemy.isBoss || enemy.eliteAffix !== null;
    const key = [enemy.archetype, chapter, minute, elite, enemy.isBoss].join("|");
    const rollup = this.spawnRollups.get(key) ?? {
      archetype: enemy.archetype,
      chapter,
      minute,
      elite,
      boss: enemy.isBoss,
      count: 0,
    };
    rollup.count++;
    this.spawnRollups.set(key, rollup);
    this.enemySpawnedAt.set(enemy, this.sys.survivors.survClock);
    if (phase) {
      this.telemetry?.capture(
        "boss_phase",
        { phase, archetype: enemy.archetype, chapter, elite, boss: enemy.isBoss },
        { elapsedSec: this.sys.survivors.survClock },
      );
    }
  }

  recordEnemyKilled(enemy: Enemy, xpDropped: number): void {
    if (!this.active) return;
    const chapter = this.ctx.survivorChapter + 1;
    const minute = Math.floor(this.sys.survivors.survClock / 60);
    const elite = enemy.isBoss || enemy.eliteAffix !== null;
    const source = this.lastDamageSource.get(enemy) ?? "unknown";
    const key = [enemy.archetype, chapter, minute, elite, enemy.isBoss, source].join("|");
    const spawnedAt = this.enemySpawnedAt.get(enemy);
    const lifetime = spawnedAt === undefined ? null : Math.max(0, this.sys.survivors.survClock - spawnedAt);
    const rollup = this.killRollups.get(key) ?? {
      archetype: enemy.archetype,
      chapter,
      minute,
      elite,
      boss: enemy.isBoss,
      damage_source: source,
      count: 0,
      xp_total: 0,
      lifetime_total_sec: 0,
      lifetime_samples: 0,
    };
    rollup.count++;
    rollup.xp_total += Math.max(0, xpDropped);
    if (lifetime !== null) {
      rollup.lifetime_total_sec += lifetime;
      rollup.lifetime_samples++;
    }
    this.killRollups.set(key, rollup);

    if (this.sys.survivors.isReaper(enemy)) {
      this.telemetry?.capture(
        "boss_phase",
        { phase: "reaper_death", archetype: enemy.archetype, chapter },
        { elapsedSec: this.sys.survivors.survClock },
      );
    } else if (elite) {
      this.telemetry?.capture(
        "boss_phase",
        { phase: "elite_death", archetype: enemy.archetype, chapter },
        { elapsedSec: this.sys.survivors.survClock },
      );
    }
  }

  recordOutgoingDamage(enemy: Enemy, source: string, amount: number, blocked: boolean, healthBefore: number): void {
    if (!this.active || amount <= 0) return;
    const key = `${source}|${enemy.archetype}`;
    const rollup = this.outgoingDamage.get(key) ?? {
      source,
      target_archetype: enemy.archetype,
      attempted: 0,
      dealt: 0,
      blocked: 0,
    };
    rollup.attempted += amount;
    if (blocked) rollup.blocked += amount;
    else rollup.dealt += Math.min(amount, Math.max(0, healthBefore));
    this.outgoingDamage.set(key, rollup);
    this.lastDamageSource.set(enemy, source);
  }

  recordIncomingPressure(source: string, sourceArchetype: string, amount: number): void {
    if (!this.active || amount <= 0) return;
    const key = `${source}|${sourceArchetype}`;
    const rollup = this.incomingPressure.get(key) ?? {
      source,
      source_archetype: sourceArchetype,
      attempted: 0,
    };
    rollup.attempted += amount;
    this.incomingPressure.set(key, rollup);
  }

  recordIncomingDamage(
    source: string,
    sourceArchetype: string,
    attempted: number,
    healthDamage: number,
    mitigated: number,
    avoided: number,
  ): void {
    if (!this.active || attempted <= 0) return;
    const key = `${source}|${sourceArchetype}`;
    const rollup = this.incomingDamage.get(key) ?? {
      source,
      source_archetype: sourceArchetype,
      attempted: 0,
      health_damage: 0,
      mitigated: 0,
      avoided: 0,
    };
    rollup.attempted += attempted;
    rollup.health_damage += Math.max(0, healthDamage);
    rollup.mitigated += Math.max(0, mitigated);
    rollup.avoided += Math.max(0, avoided);
    this.incomingDamage.set(key, rollup);
    this.lastIncomingSource = source;
    this.lastIncomingArchetype = sourceArchetype;
  }

  endRun(outcome: "win" | "dead" | "abandoned" | "restarted"): void {
    if (!this.active || !this.telemetry) return;
    if (outcome === "dead" && this.sys.survivors.reaper) {
      this.telemetry.capture(
        "boss_phase",
        {
          phase: "player_death",
          archetype: this.sys.survivors.reaper.archetype,
          chapter: this.ctx.survivorChapter + 1,
        },
        { elapsedSec: this.sys.survivors.survClock },
      );
    }
    this.flushCombatRollups();
    this.telemetry.endRun(
      {
        outcome,
        level: this.sys.survivors.level,
        kills: this.ctx.kills,
        score: this.ctx.score,
        final_build: this.currentBuild(),
        weapon_tier: this.sys.survivors.mainWeaponVisualTier(),
        gold_earned: this.pendingGold(),
        gold_from_overflow_levels: 0,
        shop_tiers: this.shopTierSummary(),
        shop_tiers_owned: this.shopTierCount(),
        war_effort_tier: warEffortTierFromDamageMultiplier(this.ctx.warEffortDamageMul),
        war_effort_damage_multiplier: this.ctx.warEffortDamageMul,
        death_cause: outcome === "dead" ? `${this.lastIncomingSource}:${this.lastIncomingArchetype}` : null,
      },
      this.sys.survivors.survClock,
    );
    this.telemetry.flush();
    this.active = false;
  }

  private progressionPayload(reason: string): Record<string, unknown> {
    const survivors = this.sys.survivors;
    const chapter = survivors.currentChapter();
    return {
      reason,
      chapter: this.ctx.survivorChapter + 1,
      chapter_name: chapter.name,
      level: survivors.level,
      xp: survivors.xp,
      xp_to_next: survivors.xpToNext,
      xp_progress: survivors.xpToNext > 0 ? survivors.xp / survivors.xpToNext : 0,
      hp_percent: this.ctx.maxHealthValue > 0 ? this.ctx.health / this.ctx.maxHealthValue : 0,
      shield_percent: this.ctx.statShieldMax > 0 ? this.ctx.statShield / this.ctx.statShieldMax : 0,
      kills: this.ctx.kills,
      enemy_count: this.ctx.aliveCount,
      gold_pending: this.pendingGold(),
      build: this.currentBuild(),
      weapon_tier: survivors.mainWeaponVisualTier(),
    };
  }

  private currentBuild(): SurvivorBuildTelemetry {
    return survivorBuildTelemetry(this.sys.survivors.upgradeLevels, this.sys.survivors.evolved);
  }

  private pendingGold(): number {
    return runGold(
      this.ctx.kills,
      this.sys.survivors.level,
      this.sys.survivors.survClock,
      this.sys.survivors.shopTiers.greed ?? 0,
    );
  }

  private shopTierSummary(): Array<{ id: string; level: number }> {
    const summary: Array<{ id: string; level: number }> = [];
    for (const [id, level] of Object.entries(this.sys.survivors.shopTiers)) {
      if (!SHOP_BY_ID[id as keyof typeof SHOP_BY_ID] || !Number.isFinite(level) || level <= 0) continue;
      summary.push({ id, level: Math.floor(level) });
    }
    return summary.sort((a, b) => a.id.localeCompare(b.id));
  }

  private shopTierCount(): number {
    return this.shopTierSummary().reduce((total, entry) => total + entry.level, 0);
  }

  private flushCombatRollups(): void {
    if (!this.telemetry) return;
    const elapsedSec = this.sys.survivors.survClock;
    if (this.spawnRollups.size > 0) {
      this.telemetry.capture("enemy_spawned", { rollups: [...this.spawnRollups.values()] }, { elapsedSec });
    }
    if (this.killRollups.size > 0) {
      const rollups = [...this.killRollups.values()].map(({ lifetime_total_sec, lifetime_samples, ...rollup }) => ({
        ...rollup,
        average_time_alive_sec: lifetime_samples > 0 ? lifetime_total_sec / lifetime_samples : null,
      }));
      this.telemetry.capture("enemy_killed", { rollups }, { elapsedSec });
    }
    if (this.outgoingDamage.size > 0 || this.incomingDamage.size > 0 || this.incomingPressure.size > 0) {
      this.telemetry.capture(
        "damage_rollup",
        {
          minute: Math.floor(elapsedSec / 60),
          outgoing: [...this.outgoingDamage.values()],
          incoming: [...this.incomingDamage.values()],
          incoming_pressure: [...this.incomingPressure.values()],
        },
        { elapsedSec },
      );
    }
    this.spawnRollups.clear();
    this.killRollups.clear();
    this.outgoingDamage.clear();
    this.incomingDamage.clear();
    this.incomingPressure.clear();
  }

  private resetRunState(): void {
    this.nextCheckpointSec = SURVIVORS_CHECKPOINT_INTERVAL_SEC;
    this.spawnRollups.clear();
    this.killRollups.clear();
    this.outgoingDamage.clear();
    this.incomingDamage.clear();
    this.incomingPressure.clear();
    this.enemySpawnedAt = new WeakMap();
    this.lastDamageSource = new WeakMap();
    this.lastIncomingSource = "unknown";
    this.lastIncomingArchetype = "unknown";
  }
}
