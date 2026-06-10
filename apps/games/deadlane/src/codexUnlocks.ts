// Codex discovery: creeps stay "???" in the codex until the player kills one.
// Shared between the imperative Game (records kills) and the React AppShell
// (reads the unlocked set when the codex opens).

import { createLocalStore } from "@deadrot/game-kit/core";
import type { CreepKind } from "./types";

/** Creep kind → @shipshitgames/assets/lore bestiary slug. */
export const CREEP_BESTIARY_SLUGS: Record<CreepKind, string> = {
  shambler: "scourge",
  ripper: "swarm-ripper",
  hulk: "graft-breacher",
  boss: "breach-boss",
};

const store = createLocalStore<{ kinds: CreepKind[] }>("deadlane:codex", { kinds: [] });

// In-memory mirror so the per-kill check never touches localStorage; a write
// happens at most once per newly discovered kind (4 total, ever).
const seen = new Set<CreepKind>(store.get().kinds);

/** Record a creep kill; persists only the first kill of each kind. */
export function recordCreepKill(kind: CreepKind): void {
  if (seen.has(kind)) return;
  seen.add(kind);
  store.set({ kinds: [...seen] });
}

/** Bestiary slugs unlocked so far, for codexEntriesForGame's unlockedSlugs. */
export function unlockedBestiarySlugs(): Set<string> {
  return new Set([...seen].map((kind) => CREEP_BESTIARY_SLUGS[kind]));
}
