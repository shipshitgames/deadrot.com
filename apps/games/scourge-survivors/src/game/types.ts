import type { FloatNumber, HudCore, HudListener } from "@deadrot/game-kit/hud";
import type { BonusIconId, PixelIconId } from "../assets/ui/pixelIcons";
import type { MainWeaponVisualTier } from "./data/survivors";

export type GameStatus =
  | "pointerlock-needed" // waiting for the player to click in to lock the pointer
  | "playing"
  | "paused"
  | "levelup" // Survivors mode: choosing an upgrade
  | "gameover";

export type RunMode = "campaign" | "structured" | "endless" | "arena" | "sandbox";

export interface UpgradeChoice {
  id: string;
  name: string;
  desc: string;
  icon: BonusIconId;
  level: number; // current level (0 if new)
  max: number;
  /** Evolution card — a golden, run-defining transform (id is `evo-<weapon>`). */
  golden?: boolean;
}

export interface BuildEntry {
  id: string;
  name: string;
  icon: BonusIconId;
  level: number;
  max: number;
  evolved?: boolean;
}

export interface WeaponIdentityState {
  callsign: string;
  role: string;
  fantasy: string;
  ads: string;
  dualCompatible: boolean;
}

/**
 * Scourge Survivors' game-specific HUD fields — everything beyond the genre-neutral
 * core (vitals, feedback channels, floating combat numbers) that the shared
 * {@link HudCoreSystem} owns. Composed with the core into {@link HudState} below.
 *
 * The game's own status machine lives here (not in the engine) so the shared core
 * stays free of Scourge-specific phases like `levelup`.
 */
export interface ScourgeHudExt {
  status: GameStatus;
  ammo: number; // rounds in current magazine
  magazineSize: number;
  reserve: number; // rounds in reserve
  reloading: boolean;
  reloadProgress: number; // 0..1 while reloading, else 0
  score: number;
  kills: number;
  headshots: number;
  /** Breach-bosses / Scourge elites felled this run (war-record mirror). */
  bossKills: number;
  enemiesAlive: number;
  /** Current kill-streak combo (0 when the streak has lapsed). */
  combo: number;
  time: number; // elapsed survival time, seconds
  /** Current run framing for summaries and leaderboard persistence. */
  runMode: RunMode;
  /** 1-based run depth: Survivors chapter, campaign stage, or arena wave. */
  runDepth: number;
  runDepthTotal: number;
  runDepthName: string;
  /** 1-based wave number among the normal waves (clamped to TOTAL_WAVES). */
  wave: number;
  totalWaves: number;
  /** Structured descent journey: 1-based current stage, total stages, current map name. */
  campaignStage: number;
  campaignTotalStages: number;
  mapName: string;
  /** True while the breach-boss or Scourge elite is on the field. */
  bossActive: boolean;
  /** 0..1 breach-boss health fraction (only meaningful while bossActive). */
  bossHealthFrac: number;
  /** Lore-given boss name for the bar label (null → the generic breach-boss banner). */
  bossName: string | null;
  /** Outcome once status === 'gameover'. */
  outcome: "win" | "dead" | null;
  /** Active weapon + the player's unlocked arsenal (for the HUD weapon strip). */
  weapon: string;
  weapons: { id: string; name: string; key: number; active: boolean }[];
  weaponIdentity: WeaponIdentityState;
  /** Remaining seconds of the damage-boost upgrade (0 when inactive). */
  damageBoost: number;
  /** Remaining seconds and normalized timer for berserk mode (0 when inactive). */
  berserk: number;
  berserkFrac: number;
  /** Remaining seconds of the dual-weapon pickup bonus (0 when inactive). */
  dualWeapon: number;
  /** True while right-click ADS is held. */
  ads: boolean;
  /** 1-based active ADS zoom level for the current weapon. */
  adsZoom: number;
  /** Total ADS zoom levels for the current weapon. */
  adsZoomLevels: number;
  /** Breach-boss ability state (only meaningful while bossActive). */
  bossShielded: boolean;
  bossEnraged: boolean;
  /** Unauthenticated PvP arena preview room state. */
  multiplayer: boolean;
  connected: boolean;
  room: string;
  scoreboard: ScoreboardEntry[];
  /** Campaign mode state, distinct from menu, sandbox, multiplayer, and Survivors. */
  campaign: boolean;
  missionId: string;
  missionTitle: string;
  missionPhase: "idle" | "active" | "complete";
  missionObjective: string;
  missionCheckpoint: string;
  missionEncounter: string;
  missionExtractionReady: boolean;
  missionComplete: boolean;
  /** Dev sandbox/labs mode: real combat sim without run/wave progression. */
  sandbox: boolean;
  /** Survivors mode state. */
  survivors: boolean;
  survivorClassId: string;
  survivorClassName: string;
  survivorClassRole: string;
  survivorClassIcon: PixelIconId;
  survivorChapter: number;
  survivorTotalChapters: number;
  survivorChapterName: string;
  survivorChapterSubtitle: string;
  survivorChapterProgress: number;
  survivorGoalTime: number;
  survivorShield: number;
  survivorMaxShield: number;
  survivorArmor: number;
  survivorDodge: number;
  survivorGrace: number;
  survivorEvolved: string[];
  /** Main-weapon tier (#279): a build-power milestone that also buffs gun damage. */
  survivorWeaponTier: MainWeaponVisualTier;
  survivorWeaponTierLabel: string;
  survivorWeaponTierIndex: number; // 0 (Tier I) … 4 (Evolved)
  survivorWeaponTierDamageMul: number;
  level: number;
  xp: number;
  xpToNext: number;
  build: BuildEntry[];
  choices: UpgradeChoice[];
  /** Draft agency: free re-rolls left for this level-up, banishes left this run. */
  rerolls: number;
  banishes: number;
}

/**
 * The full Scourge Survivors HUD frame: the shared genre-neutral core (vitals,
 * feedback channels, floating combat numbers) merged with this game's
 * {@link ScourgeHudExt}. HUD components read every field flat — `state.banner`,
 * `state.playerHealth`, `state.ammo` — exactly as they did against the old
 * monolithic state object, so nothing downstream had to change.
 */
export type HudState = HudCore<ScourgeHudExt>;

/** Floating combat number on the HUD frame (engine type; was the local `DamageNumber`). */
export type { FloatNumber };

export interface ScoreboardEntry {
  id: string;
  name: string;
  kills: number;
  health: number;
  you: boolean;
}

export type StateListener = HudListener<ScourgeHudExt>;
