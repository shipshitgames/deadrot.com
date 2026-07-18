import { BALANCE_TELEMETRY_KEY, type BalanceEvent } from "@deadrot/game-kit/telemetry";
import { expect, type Page, test } from "@playwright/test";

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

async function balanceEvents(page: Page): Promise<BalanceEvent[]> {
  return page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as {
      data?: unknown;
    } | null;
    return Array.isArray(stored?.data) ? (stored.data as BalanceEvent[]) : [];
  }, BALANCE_TELEMETRY_KEY);
}

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

    await page.evaluate(async () => {
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
    });

    const events = await balanceEvents(page);
    const names = events.map((event) => event.event);
    expect(names).toEqual(
      expect.arrayContaining(["run_start", "choice_offered", "choice_picked", "checkpoint", "run_end"]),
    );
    expect(new Set(events.map((event) => event.schema))).toEqual(new Set(["deadrot.balance.v1"]));
    expect(new Set(events.map((event) => event.runId).filter(Boolean)).size).toBe(1);
    expect(events.find((event) => event.event === "run_start")).toMatchObject({
      game: "scourge-survivors",
      mode: "survivors",
      tuningVersion: "scourge-survivors.balance.v1",
      properties: {
        map_id: "ashgate",
        class_id: "ranger",
      },
    });
    expect(events.find((event) => event.event === "run_end")).toMatchObject({
      elapsedSec: 60,
      properties: {
        outcome: "dead",
        level: 2,
      },
    });
  });
});
