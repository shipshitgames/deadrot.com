import type { SpawnDescriptor, WavePlan, WaveSchedule } from "./waveSchedule";

/** A break timer large enough that a suspended director never auto-starts a wave. */
const SUSPENDED_BREAK = 1e9;

/** Pacing knobs for a {@link WaveDirector}, all in seconds. */
export interface WaveDirectorTiming {
  /** Delay before the very first wave starts. */
  firstWaveDelay: number;
  /** Break between a cleared wave and the next one. */
  waveBreak: number;
  /**
   * Spacing between staggered spawns inside a wave. `0` makes the gate drain
   * every available slot in a single {@link WaveDirector.update} (bounded by the
   * wave's `concurrent` ceiling and its remaining `count`); a positive value
   * releases at most one spawn per update once the gate is due.
   */
  spawnInterval: number;
}

/**
 * Host hooks the director calls out through. The director owns *timing and
 * gating*; the host owns *the game world* — spawning, banners, and the boss.
 */
export interface WaveDirectorHost<M = unknown> {
  /** Current number of live spawns — drives the stagger gate. */
  aliveCount(): number;
  /** Materialise one spawn for the gated {@link SpawnDescriptor}. */
  spawn(descriptor: SpawnDescriptor<M>): void;
  /** Every normal wave is cleared — kick off the boss / finale. */
  startBoss(): void;
  /** A normal wave just started (1-based number + total). Optional banner hook. */
  onWaveStart?(waveNumber: number, totalWaves: number): void;
  /** A normal wave was just cleared (1-based number + total). Optional banner hook. */
  onWaveCleared?(waveNumber: number, totalWaves: number): void;
}

/**
 * Genre-neutral wave pacing state machine.
 *
 * It counts progress, gates staggered spawns under a concurrency ceiling, runs
 * the inter-wave break, and hands off to a boss after the final wave — without
 * knowing what a "kill", an "enemy", or a "boss" actually is. Drive it with
 * {@link update} each frame and feed it {@link notifyProgress} whenever the host
 * decides something counts toward the active wave's goal.
 *
 * The director is intentionally side-effect-light and deterministic, so it can
 * be unit-tested in isolation with a fake host.
 */
export class WaveDirector<M = unknown> {
  /** 0-based index of the active (or next) wave; equals `totalWaves` during the boss phase. */
  waveIndex = 0;
  /** True while a wave is spawning/fighting; false during the opening delay and inter-wave breaks. */
  waveActive = false;

  private breakTimer: number;
  private spawnTimer = 0;
  private spawnedThisWave = 0;
  private progressThisWave = 0;

  constructor(
    private readonly schedule: WaveSchedule<M>,
    private readonly timing: WaveDirectorTiming,
    private readonly host: WaveDirectorHost<M>,
  ) {
    this.breakTimer = timing.firstWaveDelay;
  }

  /** Total number of normal (non-boss) waves. */
  get totalWaves(): number {
    return this.schedule.length;
  }

  /** True once every normal wave is cleared and the boss phase is active. */
  get bossPhase(): boolean {
    return this.waveIndex >= this.schedule.length;
  }

  /** The plan for the active wave, or `null` during the boss phase. */
  get activePlan(): WavePlan<M> | null {
    return this.schedule[this.waveIndex] ?? null;
  }

  /** Reset to the pre-first-wave state (re-arms the opening delay). */
  reset(): void {
    this.waveIndex = 0;
    this.waveActive = false;
    this.breakTimer = this.timing.firstWaveDelay;
    this.spawnTimer = 0;
    this.spawnedThisWave = 0;
    this.progressThisWave = 0;
  }

  /**
   * Freeze the director: no wave will auto-start until {@link reset}. Used when
   * an outside authority (e.g. a co-op host/server) owns the pacing instead.
   */
  suspend(): void {
    this.waveActive = false;
    this.breakTimer = SUSPENDED_BREAK;
  }

  /**
   * Signal that something counted toward the active wave's goal (a kill, a
   * captured point, …). The host decides what qualifies; the director just
   * tallies. No-ops outside an active normal wave so stray signals during a
   * break or the boss phase can't corrupt the count.
   */
  notifyProgress(amount = 1): void {
    if (this.waveActive && this.waveIndex < this.schedule.length) {
      this.progressThisWave += amount;
    }
  }

  /** Advance pacing by `delta` seconds. */
  update(delta: number): void {
    if (!this.waveActive) {
      this.breakTimer -= delta;
      if (this.breakTimer <= 0) this.startWave();
      return;
    }
    if (this.waveIndex >= this.schedule.length) return; // boss phase: the host owns it
    const plan = this.schedule[this.waveIndex];
    if (!plan) return; // unreachable given the bounds check above; keeps the index access type-safe
    this.spawnTimer -= delta;
    // Stagger gate: release a spawn whenever there is room under `concurrent`
    // and the timer is due. The timer is *re-armed to the absolute interval*
    // after each spawn (assignment, not accumulation) — critical for two reasons:
    //   • interval > 0  → the timer becomes positive, so the loop runs at most
    //     once per update. Any negative "debt" banked while the gate was jammed
    //     at `concurrent` is discarded rather than paid down in a burst, so a
    //     freed-up field refills one-per-interval, not all-at-once.
    //   • interval === 0 → the timer stays at 0 (still <= 0), so the loop keeps
    //     draining every free slot up to `concurrent` in this single update.
    while (this.spawnedThisWave < plan.count && this.host.aliveCount() < plan.concurrent && this.spawnTimer <= 0) {
      this.host.spawn({ waveIndex: this.waveIndex, ordinal: this.spawnedThisWave, plan });
      this.spawnedThisWave++;
      this.spawnTimer = this.timing.spawnInterval;
    }
    if (this.progressThisWave >= plan.count && this.host.aliveCount() === 0) this.completeWave();
  }

  private startWave(): void {
    this.waveActive = true;
    this.progressThisWave = 0;
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
    if (this.waveIndex < this.schedule.length) {
      this.host.onWaveStart?.(this.waveIndex + 1, this.schedule.length);
    } else {
      this.host.startBoss();
    }
  }

  private completeWave(): void {
    this.waveActive = false;
    const cleared = this.waveIndex + 1;
    this.waveIndex++;
    this.breakTimer = this.timing.waveBreak;
    this.host.onWaveCleared?.(cleared, this.schedule.length);
  }
}
