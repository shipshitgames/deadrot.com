import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import "./styles.css";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Game } from "./game";
import { AppShell } from "./ui/AppShell";

void initDeadrotBrowserTelemetry({ game: "deadlane", env: import.meta.env });

const app = document.getElementById("app");
if (!app) {
  throw new Error("Deadlane: #app root not found in index.html");
}

const root = createRoot(app);
flushSync(() => {
  root.render(createElement(AppShell));
});

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Deadlane: #scene canvas not found in index.html");
}

// One Game owns everything; it kicks off its own rAF loop in the constructor.
new Game(canvas);
