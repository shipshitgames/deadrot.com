/**
 * Wave scheduling types shared by Deadrot's wave-based modes.
 *
 * These are deliberately genre-free: the {@link WaveDirector} only reasons about
 * how many spawns a wave needs and how many may be alive at once. Everything a
 * game needs to actually *build* a spawn (health/speed multipliers, archetype
 * tables, colours, …) rides along in {@link WavePlan.meta} and is handed back
 * untouched on every {@link SpawnDescriptor}.
 */

/** A single planned wave in a {@link WaveSchedule}. */
export interface WavePlan<M = unknown> {
  /** Total spawns that must be defeated to clear this wave. */
  count: number;
  /** Maximum spawns alive at once — the stagger-gate ceiling. */
  concurrent: number;
  /** Opaque per-wave payload handed back to the host on each spawn. */
  meta: M;
}

/**
 * An ordered list of normal waves.
 *
 * A boss / finale runs *after* the final plan (signalled via
 * {@link WaveDirectorHost.startBoss}); it is intentionally not a plan entry
 * because its pacing is owned by the game, not the schedule.
 */
export type WaveSchedule<M = unknown> = ReadonlyArray<WavePlan<M>>;

/**
 * One spawn the director has gated open. The host turns this into a concrete
 * entity; the director never touches the game world itself.
 */
export interface SpawnDescriptor<M = unknown> {
  /** 0-based index of the wave this spawn belongs to. */
  waveIndex: number;
  /** 0-based ordinal of this spawn within its wave (0 for the first). */
  ordinal: number;
  /** The plan for the active wave, so the host can read {@link WavePlan.meta}. */
  plan: WavePlan<M>;
}
