import "@shipshitgames/ui/styles.css";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game } from "./game/Game";
import { AppShell } from "./ui/AppShell";
import { setBridgeGame } from "./ui/gameBridge";

// Entry point. Grab the canvas + HUD root, spin up the Game, and let it own the
// requestAnimationFrame loop. Everything else lives under src/game.
const app = document.getElementById("app");
if (!app) {
  throw new Error("PACTFALL: missing #app root in index.html");
}

const root = createRoot(app);
flushSync(() => {
  root.render(createElement(AppShell));
});

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
const hud = document.getElementById("hud") as HTMLDivElement | null;

if (!canvas || !hud) {
  throw new Error("PACTFALL: missing #scene canvas or #hud overlay in index.html");
}

const game = new Game(canvas, hud);
game.start();
document.getElementById("title-start-btn")?.addEventListener("click", () => game.beginRun());

// Hand the running Game to the React shell so it can drive the pause overlay.
setBridgeGame(game);

// Convenience for poking at the running game from the console.
(window as unknown as { pactfall?: Game }).pactfall = game;
