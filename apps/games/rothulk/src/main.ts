import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Game } from "./game/Game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "rothulk", env: import.meta.env });

const app = document.getElementById("app");
if (!app) {
  throw new Error("Rothulk: #app root not found in DOM.");
}

// <AppShell> owns the #scene canvas, so the Game is constructed by the shell
// once that canvas is mounted (via this factory). This keeps the title menu,
// settings and pause overlays able to drive a single live Game instance.
const createGame = (canvas: HTMLCanvasElement) => {
  const game = new Game(canvas);
  if (import.meta.env.DEV) {
    (window as unknown as { __rothulkGame?: Game }).__rothulkGame = game;
  }
  game.start();
  return game;
};

const root = createRoot(app);
root.render(createElement(AppShell, { createGame }));
