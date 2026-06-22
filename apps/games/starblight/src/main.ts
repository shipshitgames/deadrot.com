import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game } from "./game/Game";
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

const game = new Game(canvas);
game.start();

// Clean up the loop + listeners on HMR / unload so dev reloads stay tidy.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
    root.unmount();
  });
}
