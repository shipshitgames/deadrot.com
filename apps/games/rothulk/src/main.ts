import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Game } from "./game/Game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "rothulk", env: import.meta.env });

const app = document.getElementById("app");
if (!app) {
  throw new Error("Rothulk: #app root not found in DOM.");
}
const appRoot = app;

let root: Root | null = null;
let currentGame: Game | null = null;
let generation = 0;
const debug = window as unknown as {
  __rothulkGame?: Game;
  __deadrotLifecycle?: {
    generation: () => number;
    remount: () => void;
  };
};

// <AppShell> owns the #scene canvas, so the Game is constructed by the shell
// once that canvas is mounted (via this factory). This keeps the title menu,
// settings and pause overlays able to drive a single live Game instance.
const createGame = (canvas: HTMLCanvasElement) => {
  const game = new Game(canvas);
  currentGame = game;
  if (import.meta.env.DEV) {
    debug.__rothulkGame = game;
  }
  game.start();
  return game;
};

function mountApp(): void {
  if (root) return;
  root = createRoot(appRoot);
  root.render(createElement(AppShell, { createGame }));
  generation++;
}

function disposeApp(): void {
  root?.unmount();
  root = null;
  currentGame?.dispose();
  currentGame = null;
  delete debug.__rothulkGame;
}

function remountApp(): void {
  disposeApp();
  mountApp();
}

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
