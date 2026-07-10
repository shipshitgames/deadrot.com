import { expect, type Page, test } from "@playwright/test";

type BrawlSnapshot = {
  status: "select" | "playing" | "paused" | "round-over";
  mode: "duel" | "arena";
  selectedId: string;
  arenaSlots: number;
  timer: number;
  result: { outcome: "victory" | "defeat" } | null;
  arena: { fighters: { stocks: number; eliminated: boolean }[] } | null;
  audioState?: AudioContextState | "none";
};

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Brawl" })).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __brawlGame?: unknown }).__brawlGame));
}

async function snapshot(page: Page): Promise<BrawlSnapshot> {
  return page.evaluate(() => (window as unknown as { __brawlSnapshot: () => BrawlSnapshot }).__brawlSnapshot());
}

async function waitForStatus(page: Page, status: BrawlSnapshot["status"]) {
  await page.waitForFunction(
    (expected) =>
      (window as unknown as { __brawlSnapshot?: () => BrawlSnapshot }).__brawlSnapshot?.().status === expected,
    status,
  );
}

test.describe("Brawl production flow", () => {
  test("duel -> pause -> settings/codex -> resume -> roster", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: /Warden Bastion/ }).click();
    await page.getByRole("button", { name: "Fight", exact: true }).click();
    await waitForStatus(page, "playing");
    expect((await snapshot(page)).selectedId).toBe("warden-bastion");

    const frame = await page.getByTestId("brawl-canvas").screenshot();
    expect(frame.byteLength).toBeGreaterThan(1_000);

    await page.keyboard.press("Escape");
    await waitForStatus(page, "paused");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    const pausedTimer = (await snapshot(page)).timer;
    await page.waitForTimeout(1_100);
    expect((await snapshot(page)).timer).toBe(pausedTimer);

    await page.getByRole("button", { name: /Settings/ }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await page.getByRole("slider", { name: "Sound FX level" }).fill("35");
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("shipshitgames.gameSettings.v1") ?? "{}").effectLevels?.sound,
      ),
    ).toBe(0.35);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
    expect((await snapshot(page)).status).toBe("paused");

    await page.getByRole("button", { name: /Codex/ }).click();
    await expect(page.getByRole("dialog", { name: "Codex" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Codex" })).toBeHidden();
    expect((await snapshot(page)).status).toBe("paused");

    await page.getByRole("button", { name: /Resume/ }).click();
    await waitForStatus(page, "playing");
    await page.keyboard.press("Escape");
    await waitForStatus(page, "paused");
    await page.getByRole("button", { name: /Roster/ }).click();
    await waitForStatus(page, "select");
    expect((await snapshot(page)).selectedId).toBe("warden-bastion");
  });

  test("Arena ring-out, victory, and rematch reset stocks", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: "Arena", exact: true }).click();
    await page.getByRole("group", { name: "Fighter count" }).getByRole("button", { name: "4" }).click();
    await page.getByRole("button", { name: "Start Arena" }).click();
    await waitForStatus(page, "playing");
    expect((await snapshot(page)).arena?.fighters).toHaveLength(4);

    await page.evaluate(() =>
      (window as unknown as { __brawlGame: { debugRingOut(slot: number): void } }).__brawlGame.debugRingOut(1),
    );
    await expect.poll(async () => (await snapshot(page)).arena?.fighters[1]?.stocks).toBe(2);

    await page.evaluate(() =>
      (window as unknown as { __brawlGame: { debugEliminateRivals(): void } }).__brawlGame.debugEliminateRivals(),
    );
    await waitForStatus(page, "round-over");
    expect((await snapshot(page)).result?.outcome).toBe("victory");
    await expect(page.getByLabel("Round result")).toBeVisible();

    await page.getByRole("button", { name: "Rematch" }).click();
    await waitForStatus(page, "playing");
    expect((await snapshot(page)).arena?.fighters.map((fighter) => fighter.stocks)).toEqual([3, 3, 3, 3]);
  });

  test("dispose cancels animation/input work and closes browser resources", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await boot(page);
    await page.getByRole("button", { name: "Fight", exact: true }).click();
    await waitForStatus(page, "playing");

    const lifecycle = await page.evaluate(() => {
      const game = (
        window as unknown as {
          __brawlGame: {
            dispose(): void;
            debugLifecycle(): { disposed: boolean; frameScheduled: boolean; audioState: AudioContextState | "none" };
          };
        }
      ).__brawlGame;
      game.dispose();
      game.dispose();
      return game.debugLifecycle();
    });

    expect(lifecycle).toEqual({ disposed: true, frameScheduled: false, audioState: "none" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    expect((await snapshot(page)).status).toBe("playing");
    expect(pageErrors).toEqual([]);
  });
});
