import type { PixelIconId } from "../assets/ui/pixelIcons";

export type GameStatus =
  | "pointerlock-needed" // waiting for the player to click in to lock the pointer
  | "playing"
  | "paused"
  | "levelup" // Survivors mode: choosing an upgrade
  | "gameover";

export interface UpgradeChoice {
  id: string;
  name: string;
  desc: string;
  icon: PixelIconId;
  level: number; // current level (0 if new)
  max: number;
  /** Evolution card — a golden, run-defining transform (id is `evo-<weapon>`). */
  golden?: boolean;
}

export interface BuildEntry {
  id: string;
  name: string;
  icon: PixelIconId;
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

export interface HUDState {
  status: GameStatus;
  playerHealth: number;
  maxPlayerHealth: number;
  ammo: number; // rounds in current magazine
  magazineSize: number;
  reserve: number; // rounds in reserve
  reloading: boolean;
  reloadProgress: number; // 0..1 while reloading, else 0
  score: number;
  kills: number;
  headshots: number;
  enemiesAlive: number;
  /** Current kill-streak combo (0 when the streak has lapsed). */
  combo: number;
  time: number; // elapsed survival time, seconds
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
  /** Monotonic counters used by the HUD to trigger transient animations. */
  hitMarkerSeq: number;
  headshotSeq: number;
  killSeq: number;
  damageSeq: number;
  /** Transient centre-screen banner ("WAVE 2", "BREACH-BOSS", ...). */
  banner: string;
  bannerSeq: number;
  /** Small transient toast for pickups ("+ SHOTGUN", "+35 HP", ...). */
  toast: string;
  toastSeq: number;
  /** Floating damage numbers, anchored to where the hit landed (screen %). */
  damageNumbers: DamageNumber[];
  /** Co-op breach room state. */
  multiplayer: boolean;
  connected: boolean;
  room: string;
  scoreboard: ScoreboardEntry[];
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
  level: number;
  xp: number;
  xpToNext: number;
  build: BuildEntry[];
  choices: UpgradeChoice[];
  /** Draft agency: free re-rolls left for this level-up, banishes left this run. */
  rerolls: number;
  banishes: number;
}

export interface DamageNumber {
  id: number;
  /** Screen position as a percentage of the viewport (0–100). */
  x: number;
  y: number;
  amount: number;
  kind: "normal" | "head" | "crit";
}

export interface ScoreboardEntry {
  id: string;
  name: string;
  kills: number;
  health: number;
  you: boolean;
}

export type StateListener = (state: HUDState) => void;
