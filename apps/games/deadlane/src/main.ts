import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Game } from "./game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "deadlane", env: import.meta.env });

const app = document.getElementById("app");
if (!app) {
  throw new Error("Deadlane: #app root not found in index.html");
}
const appRoot = app;

let root: Root | null = null;
let game: Game | null = null;
let generation = 0;
const debug = window as unknown as {
  __deadlaneGame?: unknown;
  __deadrotLifecycle?: {
    generation: () => number;
    remount: () => void;
  };
};

function mountApp(): void {
  if (root || game) return;
  root = createRoot(appRoot);
  flushSync(() => {
    root?.render(createElement(AppShell));
  });

  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error("Deadlane: #scene canvas not found in index.html");
  }

  // One Game owns everything; it kicks off its own rAF loop in the constructor.
  game = new Game(canvas);
  generation++;
}

function disposeApp(): void {
  const current = game;
  game = null;
  current?.dispose();
  root?.unmount();
  root = null;
  delete debug.__deadlaneGame;
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
