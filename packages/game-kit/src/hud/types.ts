import type { Camera, Vector3 } from "three";

/**
 * Universal HUD vitals every action game surfaces. Game-specific resources
 * (shields, armour, ammo, …) stay in the per-game HUD extension.
 */
export interface Vitals {
  playerHealth: number;
  maxPlayerHealth: number;
}

/** A floating combat number anchored to screen-space (0–100% of the viewport). */
export interface FloatNumber {
  id: number;
  /** Screen position as a percentage of the viewport (0–100). */
  x: number;
  y: number;
  amount: number;
  kind: FloatKind;
}

export type FloatKind = "normal" | "head" | "crit";

/**
 * Monotonic feedback channels plus the transient text the HUD animates on
 * change. Each `*Seq` counter only ever increments, so a React HUD can key
 * off the value to re-trigger a one-shot animation.
 *
 * `hitSeq`/`emphasisSeq` were named `hitMarkerSeq`/`headshotSeq` while this
 * logic lived inside Scourge Survivors; the engine names are genre-neutral so
 * other shooters can reuse the same channels (e.g. emphasis = headshot/crit).
 */
export interface HudFeedback {
  /** A landed hit-marker tick. */
  hitSeq: number;
  /** An emphasised hit — headshot, crit, or other highlight beat. */
  emphasisSeq: number;
  /** A confirmed kill. */
  killSeq: number;
  /** The local player taking damage. */
  damageSeq: number;
  /** Transient centre-screen banner ("WAVE 2", "BREACH-BOSS", …). */
  banner: string;
  bannerSeq: number;
  /** Small transient toast for pickups ("+ SHOTGUN", "+35 HP", …). */
  toast: string;
  toastSeq: number;
}

/**
 * The shared HUD frame: the universal core (vitals + feedback channels +
 * floating combat numbers) merged with a per-game extension `E` carrying every
 * game-specific field (status, ammo, waves, survivors stats, …).
 *
 * Kept as a flat intersection on purpose: HUD components read `state.banner`,
 * `state.playerHealth`, `state.killSeq`, … directly, exactly as they did
 * against the old monolithic state object.
 */
export type HudCore<E> = Vitals & HudFeedback & HudFloats & E;

/** Floating combat numbers carried on the HUD frame. */
export interface HudFloats {
  damageNumbers: FloatNumber[];
}

/** Receives every assembled HUD frame (typically a React `setState`). */
export type HudListener<E> = (state: HudCore<E>) => void;

/**
 * The minimal host the generic HUD system reads each frame: a camera to
 * project world-space combat numbers, a monotonic clock for float TTLs, and a
 * disposed flag so a torn-down game can't push a late frame.
 */
export interface HudHost {
  readonly camera: Camera;
  readonly time: number;
  readonly disposed: boolean;
}

/**
 * Game-supplied bridge that turns the live game state into a HUD frame. The
 * generic system owns the feedback channels and floats; the extension owns
 * everything game-specific.
 */
export interface HudExtension<E> {
  /** Universal vitals for this frame. */
  vitals(): Vitals;
  /** Game-specific HUD fields for this frame. */
  read(): E;
  /** Optional: map an `announce()` banner to an audio cue. */
  onAnnounce?(text: string): void;
}

/** Re-exported for extension authors that project their own world positions. */
export type { Camera, Vector3 };
