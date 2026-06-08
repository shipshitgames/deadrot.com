// localStorage-backed leaderboard + audio settings (no backend required).

import type { RunMode } from "./types";

export interface ScoreEntry {
  score: number;
  kills: number;
  headshots: number;
  time: number;
  outcome: "win" | "dead";
  mode?: RunMode;
  level?: number;
  depthReached?: number;
  depthTotal?: number;
  depthName?: string;
  goldEarned?: number;
  date: number;
}

const SCORES_KEY = "scourge-survivors.scores.v1";
const SETTINGS_KEY = "scourge-survivors.settings.v1";
const MAX_SCORES = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const s = entry as Partial<ScoreEntry>;
        return {
          score: Math.max(0, Number(s.score) || 0),
          kills: Math.max(0, Number(s.kills) || 0),
          headshots: Math.max(0, Number(s.headshots) || 0),
          time: Math.max(0, Number(s.time) || 0),
          outcome: s.outcome === "win" ? "win" : "dead",
          mode: normalizeRunMode(s.mode),
          level: positiveNumber(s.level),
          depthReached: positiveNumber(s.depthReached),
          depthTotal: positiveNumber(s.depthTotal),
          depthName: typeof s.depthName === "string" ? s.depthName : undefined,
          goldEarned: positiveNumber(s.goldEarned),
          date: Number(s.date) || Date.now(),
        };
      });
  } catch {
    return [];
  }
}

function normalizeRunMode(mode: unknown): RunMode | undefined {
  return mode === "campaign" || mode === "structured" || mode === "endless" || mode === "coop" || mode === "sandbox"
    ? mode
    : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Adds an entry, keeps the top {@link MAX_SCORES} by score, returns the new list. */
export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.kills - a.kills);
  const top = list.slice(0, MAX_SCORES);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(top));
  } catch {
    /* ignore quota / private-mode errors */
  }
  return top;
}

export function clearScores(): ScoreEntry[] {
  try {
    localStorage.removeItem(SCORES_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export interface Settings {
  music: boolean;
  sfx: boolean;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { music: s.music !== false, sfx: s.sfx !== false };
    }
  } catch {
    /* ignore */
  }
  return { music: true, sfx: true };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---- Survivors meta-progression (persistent gold + permanent upgrade tiers) ----
const SHOP_KEY = "scourge-survivors.shop.v1";

export interface ShopState {
  gold: number;
  tiers: Record<string, number>;
}

export function loadShop(): ShopState {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { gold: Math.max(0, Number(s.gold) || 0), tiers: s.tiers && typeof s.tiers === "object" ? s.tiers : {} };
    }
  } catch {
    /* ignore */
  }
  return { gold: 0, tiers: {} };
}

export function saveShop(s: ShopState) {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
