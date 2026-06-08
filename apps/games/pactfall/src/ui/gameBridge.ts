import type { Game } from "../game/Game";

// Tiny bridge between the vanilla Game (which owns the rAF loop + canvas/HUD
// DOM) and the React shell (which renders the settings + pause overlays). The
// shell mounts first so the Game can cache its HUD refs, then `main.ts` hands
// the Game over here once it exists. Keeping this out of React state avoids
// re-rendering — and tearing down — the canvas/HUD the Game depends on.
let current: Game | null = null;
const listeners = new Set<(game: Game | null) => void>();

export function setBridgeGame(game: Game | null): void {
  current = game;
  for (const listener of listeners) listener(game);
}

export function getBridgeGame(): Game | null {
  return current;
}

export function subscribeBridgeGame(listener: (game: Game | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
