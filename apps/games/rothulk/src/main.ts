import "@shipshitgames/ui/styles.css";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game } from "./game/Game";
import { AppShell } from "./ui/AppShell";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Rothulk: #app root not found in DOM.");
}

const root = createRoot(app);
flushSync(() => {
  root.render(createElement(AppShell));
});

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const banner = document.getElementById("banner") as HTMLDivElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;

if (!canvas) {
  throw new Error("Rothulk: #scene canvas not found in DOM.");
}

const game = new Game(canvas);
game.start();

function beginRun() {
  banner.classList.add("hidden");
  game.beginRun();
}

startBtn?.addEventListener("click", beginRun);

// Pressing any reasonable key on the title screen also breaches.
window.addEventListener(
  "keydown",
  (e) => {
    if (banner.classList.contains("hidden")) return;
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyW" || e.code === "ArrowUp") {
      e.preventDefault();
      beginRun();
    }
  },
  { passive: false },
);
