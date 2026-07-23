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

interface StarblightDebugHook {
  snapshot: () => ReturnType<Game["debugSnapshot"]>;
  startRun: () => void;
  advance: (seconds: number) => void;
  spawnTarget: () => void;
  forceLevelUp: () => void;
  pickDraftCard: (id: Parameters<Game["debugPickDraftCard"]>[0]) => void;
  forceBoss: () => void;
  setBossHp01: (hp01: number) => void;
}

const debugWindow = window as unknown as { __starblight?: StarblightDebugHook };
let debugActive = false;
let debugHook: StarblightDebugHook | undefined;

// The adapter is deliberately absent from production builds. It exposes only
// serialized snapshots and bounded actions, never the running Game instance.
if (import.meta.env.DEV) {
  debugActive = true;
  const assertDebugActive = () => {
    if (!debugActive) throw new Error("Starblight debug handle is disposed");
  };
  debugHook = {
    snapshot: () => {
      assertDebugActive();
      return game.debugSnapshot();
    },
    startRun: () => {
      assertDebugActive();
      game.debugStartRun();
    },
    advance: (seconds) => {
      assertDebugActive();
      game.debugAdvance(seconds);
    },
    spawnTarget: () => {
      assertDebugActive();
      game.debugSpawnTarget();
    },
    forceLevelUp: () => {
      assertDebugActive();
      game.debugForceLevelUp();
    },
    pickDraftCard: (id) => {
      assertDebugActive();
      game.debugPickDraftCard(id);
    },
    forceBoss: () => {
      assertDebugActive();
      game.debugForceBoss();
    },
    setBossHp01: (hp01) => {
      assertDebugActive();
      game.debugSetBossHp01(hp01);
    },
  };
  debugWindow.__starblight = debugHook;
}

// Clean up the loop + listeners on HMR / unload so dev reloads stay tidy.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    debugActive = false;
    if (debugHook && debugWindow.__starblight === debugHook) delete debugWindow.__starblight;
    game.dispose();
    root.unmount();
  });
}
