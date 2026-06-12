/**
 * REDLINE — entry point.
 * Wires the canvas to the Game and starts the loop.
 */

import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game } from "./game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "redline", env: import.meta.env });

const app = document.getElementById("app");
if (!app) {
  throw new Error("REDLINE: #app root not found");
}

const root = createRoot(app);
flushSync(() => {
  root.render(createElement(AppShell));
});

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("REDLINE: #scene canvas not found");
}

const game = new Game(canvas);
game.start();

// Expose for quick console poking during development.
declare global {
  interface Window {
    __REDLINE__?: Game;
  }
}
window.__REDLINE__ = game;
