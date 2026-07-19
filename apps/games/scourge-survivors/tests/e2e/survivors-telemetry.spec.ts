import { BALANCE_TELEMETRY_KEY, type BalanceEvent } from "@deadrot/game-kit/telemetry";
import { expect, test } from "@playwright/test";

type DevGame = {
  startSurvivors: (classId: "ranger") => Promise<void>;
  pickUpgrade: (id: string) => void;
  ctx: { status: string };
  sys: {
    survivors: {
      choices: Array<{ id: string }>;
      gainXp: (amount: number) => void;
      survClock: number;
      xpToNext: number;
    };
    telemetry: { update: () => void };
    gameOver: { gameOver: (outcome: "dead") => void };
  };
};

test.describe("Survivors balance telemetry lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
        configurable: true,
        value: function requestPointerLock() {},
      });
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: function exitPointerLock() {},
      });
    });
  });

  test("buffers start, draft, checkpoint, and end events from a real run", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const events = await page.evaluate(async (key) => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      await game.startSurvivors("ranger");
      game.ctx.status = "playing";
      game.sys.survivors.gainXp(game.sys.survivors.xpToNext);
      const choice = game.sys.survivors.choices[0];
      if (!choice) throw new Error("level-up did not offer a Survivors draft choice");
      game.pickUpgrade(choice.id);
      game.sys.survivors.survClock = 60;
      game.sys.telemetry.update();
      game.sys.gameOver.gameOver("dead");

      const stored = JSON.parse(localStorage.getItem(key) ?? "null") as {
        data?: unknown;
      } | null;
      return Array.isArray(stored?.data) ? (stored.data as BalanceEvent[]) : [];
    }, BALANCE_TELEMETRY_KEY);

    const runStart = [...events].reverse().find((event) => event.event === "run_start");
    expect(runStart?.runId).toBeTruthy();
    const runEvents = events.filter((event) => event.runId === runStart?.runId);
    const runEnd = runEvents.find((event) => event.event === "run_end");
    const names = runEvents.map((event) => event.event);
    expect(names).toEqual(
      expect.arrayContaining(["run_start", "choice_offered", "choice_picked", "checkpoint", "run_end"]),
    );
    expect(new Set(runEvents.map((event) => event.schema))).toEqual(new Set(["deadrot.balance.v1"]));
    expect(runStart).toMatchObject({
      game: "scourge-survivors",
      mode: "survivors",
      tuningVersion: "scourge-survivors.balance.v1",
      properties: {
        map_id: "ashgate",
        class_id: "ranger",
      },
    });
    expect(runEnd).toMatchObject({
      elapsedSec: 60,
      properties: {
        outcome: "dead",
        level: 2,
      },
    });
  });
});
