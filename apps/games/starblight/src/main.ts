import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game, type StarblightDevHandle } from "./game/Game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "starblight", env: import.meta.env });

// Entry point: grab the canvas declared in index.html, boot the Game, and let
// its requestAnimationFrame loop drive everything.
const app = document.getElementById("app");
if (!app) {
  throw new Error("#app root not found");
}

const root = createRoot(app);
flushSync(() => {
  root.render(createElement(AppShell));
});

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("#scene canvas not found");
}

const debugRequested = new URLSearchParams(window.location.search).has("debug");
const game = new Game(canvas, { devMode: import.meta.env.DEV, profiler: debugRequested });
game.start();

let removeDebugControls = () => {};
if (import.meta.env.DEV) {
  const devHandle = game.createDevHandle();
  window.__game = devHandle;
  const onDebugToggle = (event: KeyboardEvent) => {
    if (event.key === "`" && !event.metaKey && !event.ctrlKey && !event.altKey) devHandle.toggleProfiler();
  };
  window.addEventListener("keydown", onDebugToggle);
  removeDebugControls = () => {
    window.removeEventListener("keydown", onDebugToggle);
    delete window.__game;
  };
}

// Clean up the loop + listeners on HMR / unload so dev reloads stay tidy.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    removeDebugControls();
    game.dispose();
    root.unmount();
  });
}

declare global {
  interface Window {
    __game?: StarblightDevHandle;
  }
}
