import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Game } from "./game/Game";
import { AppShell } from "./ui/AppShell";
import { setBridgeGame } from "./ui/gameBridge";

void initDeadrotBrowserTelemetry({ game: "pactfall", env: import.meta.env });

// Entry point. Grab the canvas + HUD root, spin up the Game, and let it own the
// requestAnimationFrame loop. Everything else lives under src/game.
const app = document.getElementById("app");
if (!app) {
  throw new Error("PACTFALL: missing #app root in index.html");
}
const appRoot = app;

let root: Root | null = null;
let game: Game | null = null;
let generation = 0;

function mountApp(): void {
  if (root || game) return;
  root = createRoot(appRoot);
  flushSync(() => {
    root?.render(createElement(AppShell));
  });

  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  const hud = document.getElementById("hud") as HTMLDivElement | null;

  if (!canvas || !hud) {
    throw new Error("PACTFALL: missing #scene canvas or #hud overlay in index.html");
  }

  game = new Game(canvas, hud);
  game.start();
  generation++;

  // Hand the running Game to the React shell so it can drive the pause overlay.
  setBridgeGame(game);

  debug.pactfall = game;
  debug.__pactfallGame = game;
  debug.__pactfallSnapshot = () => game?.snapshot();
}

function disposeApp(): void {
  const current = game;
  game = null;
  setBridgeGame(null);
  current?.dispose();
  root?.unmount();
  root = null;
  delete debug.pactfall;
  delete debug.__pactfallGame;
  delete debug.__pactfallSnapshot;
}

function remountApp(): void {
  disposeApp();
  mountApp();
}

// Convenience for poking at the running game from the console, plus the e2e
// hooks the Playwright harness reads (mirrors __brawlGame / __rothulkGame).
const debug = window as unknown as {
  pactfall?: Game;
  __pactfallGame?: Game;
  __pactfallSnapshot?: () => ReturnType<Game["snapshot"]> | undefined;
  __deadrotLifecycle?: {
    generation: () => number;
    remount: () => void;
  };
};

if (import.meta.env.DEV) {
  debug.__deadrotLifecycle = { generation: () => generation, remount: remountApp };
}

mountApp();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeApp();
    delete debug.__deadrotLifecycle;
  });
}
