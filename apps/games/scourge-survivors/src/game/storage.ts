// localStorage-backed leaderboard + audio settings (no backend required).

import { type GlobalEffectLevels, loadGlobalGameSettings, saveGlobalGameSettings } from "@shipshitgames/ui";

export interface ScoreEntry {
  score: number;
  kills: number;
  headshots: number;
  time: number;
  outcome: "win" | "dead";
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
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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
  effectLevels: GlobalEffectLevels;
}

export function loadSettings(): Settings {
  const global = loadGlobalGameSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { music: !global.musicMuted, sfx: s.sfx !== false, effectLevels: global.effectLevels };
    }
  } catch {
    /* ignore */
  }
  return { music: !global.musicMuted, sfx: true, effectLevels: global.effectLevels };
}

export function saveSettings(s: Settings) {
  saveGlobalGameSettings({ effectLevels: s.effectLevels, musicMuted: !s.music });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: s.music, sfx: s.sfx }));
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
