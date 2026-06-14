import { expect, type Locator, type Page, test } from "@playwright/test";

// The most gold a single run can ever pay out (RUN_GOLD_CAP in survivors.ts).
// Kept in sync with the unit suite, which asserts the cap against the data module.
const RUN_GOLD_CAP = 1500;
const SHOP_KEY = "scourge-survivors.shop.v1";

type SeedShop = { gold: number; tiers?: Record<string, number> };

/** Seed the persistent shop wallet before the app's `loadShop()` runs on mount. */
async function seedShop(page: Page, seed: SeedShop): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      // Pointer-lock is unavailable in headless Chromium; stub it so the menu boots.
      Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
        configurable: true,
        value: function requestPointerLock() {},
      });
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: function exitPointerLock() {},
      });
    },
    { key: SHOP_KEY, value: JSON.stringify({ gold: seed.gold, tiers: seed.tiers ?? {} }) },
  );
}

/** Walk the title splash -> Survivors hub -> Shop screen. */
async function openShop(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Shop/i }).click();
  await expect(page.getByTestId("shop-panel")).toBeVisible();
}

/** Current wallet balance, read from the rendered shop header (not a literal). */
async function readGold(page: Page): Promise<number> {
  return Number(await page.getByTestId("shop-gold").getAttribute("data-gold"));
}

/** Parse the gold cost shown on a buy button (the button text is the price). */
async function readCost(buyButton: Locator): Promise<number> {
  return Number(((await buyButton.textContent()) ?? "").replace(/[^\d]/g, ""));
}

test.describe("gold-shop economy (#277)", () => {
  test("a single run's gold cannot complete the shop", async ({ page }) => {
    // Seed the wallet with the absolute most one run could ever earn.
    await seedShop(page, { gold: RUN_GOLD_CAP });
    await openShop(page);

    const progress = page.getByTestId("shop-progress");
    const total = Number(await progress.getAttribute("data-total"));
    const remaining = Number(await progress.getAttribute("data-remaining"));
    const owned = Number(await progress.getAttribute("data-owned"));
    // Read the wallet straight from the rendered DOM rather than trusting the
    // local literal, so the core assertion stays honest if the cap ever moves.
    const walletGold = await readGold(page);

    expect(owned).toBe(0);
    expect(total).toBeGreaterThan(0);
    expect(walletGold).toBe(RUN_GOLD_CAP);
    // Even holding a full run's payout, the gold still owed to finish the armory
    // exceeds what that run gave you — so one run can never buy everything.
    expect(remaining).toBeGreaterThan(walletGold);

    // And the wallet itself shows less than the remaining cost.
    await expect(progress).toContainText("to fully upgrade");
  });

  test("buying an upgrade spends gold and advances the armory progress", async ({ page }) => {
    await seedShop(page, { gold: 60 }); // enough for the cheapest tiers, not the shop
    await openShop(page);

    const progress = page.getByTestId("shop-progress");
    await expect(progress).toHaveAttribute("data-owned", "0");

    // Ichor Draw (magnetP) is the cheapest first tier (base 30).
    const buyMagnet = page.getByTestId("shop-buy-magnetP");
    await expect(buyMagnet).toBeEnabled();
    await expect(page.getByTestId("shop-tier-magnetP")).toHaveText("0/4");

    const goldBefore = await readGold(page);
    const firstCost = await readCost(buyMagnet);
    expect(firstCost).toBeGreaterThan(0);

    await buyMagnet.click();

    await expect(page.getByTestId("shop-tier-magnetP")).toHaveText("1/4");
    await expect(progress).toHaveAttribute("data-owned", "1");
    // The wallet actually paid the first-tier cost — not just a UI tick.
    await expect(page.getByTestId("shop-gold")).toHaveAttribute("data-gold", String(goldBefore - firstCost));
    // And the next tier costs strictly more than the first (escalating cost).
    const nextCost = await readCost(buyMagnet);
    expect(nextCost).toBeGreaterThan(firstCost);
  });

  test("communicates unaffordable and maxed states", async ({ page }) => {
    // 20 gold is below every first-tier cost (cheapest is 30).
    await seedShop(page, { gold: 20 });
    await openShop(page);

    const buyMagnet = page.getByTestId("shop-buy-magnetP");
    await expect(buyMagnet).toBeDisabled();
    await expect(buyMagnet).toHaveAttribute("data-afford", "false");
  });

  test("a maxed single-tier upgrade shows MAX and disables its button", async ({ page }) => {
    // Pre-own the Cautery Kit (arsenal, max 1) so it renders in its purchased state.
    await seedShop(page, { gold: 0, tiers: { arsenal: 1 } });
    await openShop(page);

    const buyArsenal = page.getByTestId("shop-buy-arsenal");
    await expect(buyArsenal).toHaveText("MAX");
    await expect(buyArsenal).toBeDisabled();
    await expect(buyArsenal).toHaveAttribute("data-maxed", "true");
    await expect(page.getByTestId("shop-tier-arsenal")).toHaveText("1/1");
  });

  test("shows a fully-upgraded armory once every tier is owned", async ({ page }) => {
    // Seed every known upgrade well past its max. sanitize + clamp collapse these
    // to each upgrade's real max, so the armory renders as complete. If a new
    // upgrade is ever added and not seeded here, data-owned < data-total and this
    // test fails loudly — exactly the signal we want.
    const MAXED: Record<string, number> = {
      might: 99,
      vigor: 99,
      swift: 99,
      regenP: 99,
      magnetP: 99,
      scholar: 99,
      greed: 99,
      arsenal: 99,
      munitions: 99,
      pulsar: 99,
    };
    await seedShop(page, { gold: 0, tiers: MAXED });
    await openShop(page);

    const progress = page.getByTestId("shop-progress");
    const total = await progress.getAttribute("data-total");
    await expect(progress).toHaveAttribute("data-owned", String(total));
    await expect(progress).toHaveAttribute("data-remaining", "0");
    await expect(progress).toContainText(/Fully upgraded/i);

    // A representative multi-tier upgrade is maxed, disabled, and its row label is
    // clamped to the true max (no "99/5" leaking through).
    const buyMight = page.getByTestId("shop-buy-might");
    await expect(buyMight).toHaveText("MAX");
    await expect(buyMight).toBeDisabled();
    await expect(buyMight).toHaveAttribute("data-maxed", "true");
    await expect(page.getByTestId("shop-tier-might")).toHaveText("5/5");
  });
});
