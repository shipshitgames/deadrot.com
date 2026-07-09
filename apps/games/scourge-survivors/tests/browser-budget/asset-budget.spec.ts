import { expect, type Page, test } from "@playwright/test";
import assetBudgets from "../../../../../packages/assets/asset-budgets.json" with { type: "json" };

type BrowserBudget = {
  maxBootResourceRequests: number;
  maxBootWebpRequests: number;
  maxBootDecodedBodyBytes: number;
  maxCombatResourceRequests: number;
  maxCombatWebpRequests: number;
  maxCombatDecodedBodyBytes: number;
};

type BrowserResource = {
  pathname: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
};

type ResourceSnapshot = {
  entries: BrowserResource[];
  webpEntries: BrowserResource[];
  transferBytes: number;
  encodedBodyBytes: number;
  decodedBodyBytes: number;
  webpTransferBytes: number;
  webpEncodedBodyBytes: number;
  webpDecodedBodyBytes: number;
};

const budget = assetBudgets.games["scourge-survivors"] as BrowserBudget;
const RESOURCE_QUIET_MS = 2_000;
const RESOURCE_SETTLE_TIMEOUT_MS = 45_000;

// Vite retains each source basename before its content hash. None of these
// combat-only payload families belongs on the title splash.
const FORBIDDEN_BOOT_COMBAT_BASENAMES = [
  /^frame-\d{2}-/,
  /^scourge\.atlas\d*-/,
  /^(?:pistol|smg|shotgun|cannon|sniper)(?:-ads)?-tiers-/,
  /^(?:pistol|smg|shotgun|cannon|sniper)-loot-/,
  /^(?:floor|wall|column|block)-/,
  /^(?:muzzle-flash|enemy-spit|boss-barrage|pyre-bolt|pyre-orb)-/,
];

async function settleResourceTimings(page: Page): Promise<void> {
  const deadline = Date.now() + RESOURCE_SETTLE_TIMEOUT_MS;
  let previousCount = -1;
  let quietSince = Date.now();

  while (Date.now() < deadline) {
    const count = await page.evaluate(() => performance.getEntriesByType("resource").length);
    if (count !== previousCount) {
      previousCount = count;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= RESOURCE_QUIET_MS) {
      return;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Browser resources did not stay quiet for ${RESOURCE_QUIET_MS}ms`);
}

async function resourceSnapshot(page: Page): Promise<ResourceSnapshot> {
  return page.evaluate(() => {
    const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) => new URL(entry.name).origin === window.location.origin)
      .map((entry) => ({
        pathname: new URL(entry.name).pathname,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      }));
    const webpEntries = entries.filter((entry) => entry.pathname.endsWith(".webp"));
    const sum = (resources: typeof entries, field: "transferSize" | "encodedBodySize" | "decodedBodySize") =>
      resources.reduce((total, entry) => total + entry[field], 0);

    return {
      entries,
      webpEntries,
      transferBytes: sum(entries, "transferSize"),
      encodedBodyBytes: sum(entries, "encodedBodySize"),
      decodedBodyBytes: sum(entries, "decodedBodySize"),
      webpTransferBytes: sum(webpEntries, "transferSize"),
      webpEncodedBodyBytes: sum(webpEntries, "encodedBodySize"),
      webpDecodedBodyBytes: sum(webpEntries, "decodedBodySize"),
    };
  });
}

function basename(pathname: string): string {
  return decodeURIComponent(pathname.split("/").at(-1) ?? pathname);
}

function resourceDelta(before: ResourceSnapshot, after: ResourceSnapshot): ResourceSnapshot {
  const entries = after.entries.slice(before.entries.length);
  const webpEntries = entries.filter((entry) => entry.pathname.endsWith(".webp"));
  const sum = (resources: BrowserResource[], field: "transferSize" | "encodedBodySize" | "decodedBodySize") =>
    resources.reduce((total, entry) => total + entry[field], 0);
  return {
    entries,
    webpEntries,
    transferBytes: sum(entries, "transferSize"),
    encodedBodyBytes: sum(entries, "encodedBodySize"),
    decodedBodyBytes: sum(entries, "decodedBodySize"),
    webpTransferBytes: sum(webpEntries, "transferSize"),
    webpEncodedBodyBytes: sum(webpEntries, "encodedBodySize"),
    webpDecodedBodyBytes: sum(webpEntries, "decodedBodySize"),
  };
}

function logSnapshot(phase: string, snapshot: ResourceSnapshot): void {
  console.log(
    JSON.stringify({
      phase,
      resourceRequests: snapshot.entries.length,
      transferBytes: snapshot.transferBytes,
      encodedBodyBytes: snapshot.encodedBodyBytes,
      decodedBodyBytes: snapshot.decodedBodyBytes,
      webpRequests: snapshot.webpEntries.length,
      webpTransferBytes: snapshot.webpTransferBytes,
      webpEncodedBodyBytes: snapshot.webpEncodedBodyBytes,
      webpDecodedBodyBytes: snapshot.webpDecodedBodyBytes,
    }),
  );
}

test("production boot defers combat WebPs until the run transition", async ({ page }) => {
  // The default Resource Timing buffer is too small for the regression this
  // test guards. Install this before any application script can request assets.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5_000));

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Press Enter to continue", { exact: true })).toBeVisible();
  await settleResourceTimings(page);

  logSnapshot("title-splash", await resourceSnapshot(page));

  // Use the real production menu: production builds intentionally expose no
  // __fpsGame/__hudSnapshot test hooks.
  await page.keyboard.press("Enter");
  const hub = page.getByRole("navigation", { name: /survivors hub/i });
  await hub.getByRole("button", { name: /Play a Run/i }).click();
  await expect(page.getByText("Operator Loadout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Choose Breach Site/i }).click();
  await expect(page.locator(".ssg-section-heading", { hasText: "Breach Site" })).toBeVisible();
  await settleResourceTimings(page);

  const beforeCombat = await resourceSnapshot(page);
  const forbiddenBootAssets = beforeCombat.webpEntries
    .map((entry) => basename(entry.pathname))
    .filter((name) => FORBIDDEN_BOOT_COMBAT_BASENAMES.some((pattern) => pattern.test(name)));
  logSnapshot("menu-pre-combat", beforeCombat);

  expect(forbiddenBootAssets, `combat WebPs requested before combat: ${forbiddenBootAssets.join(", ")}`).toEqual([]);
  expect(beforeCombat.entries.length, "pre-combat resource request budget").toBeLessThanOrEqual(
    budget.maxBootResourceRequests,
  );
  expect(beforeCombat.webpEntries.length, "pre-combat WebP request budget").toBeLessThanOrEqual(
    budget.maxBootWebpRequests,
  );
  expect(beforeCombat.decodedBodyBytes, "pre-combat decoded resource body budget").toBeLessThanOrEqual(
    budget.maxBootDecodedBodyBytes,
  );

  await page.getByRole("button", { name: /^Play a Run$/i }).click();
  await expect(page.getByRole("button", { name: "Click to play", exact: true })).toBeVisible();
  await expect(page.getByTestId("combat-asset-loading")).toHaveCount(0);
  await settleResourceTimings(page);

  const afterCombat = await resourceSnapshot(page);
  const combat = resourceDelta(beforeCombat, afterCombat);
  logSnapshot("combat-transition", combat);

  expect(combat.entries.length, "combat transition must load at least one resource").toBeGreaterThan(0);
  expect(combat.webpEntries.length, "combat transition must load at least one WebP payload").toBeGreaterThan(0);
  expect(combat.decodedBodyBytes, "combat transition must load a non-empty resource body").toBeGreaterThan(0);
  expect(combat.entries.length, "combat-transition resource request budget").toBeLessThanOrEqual(
    budget.maxCombatResourceRequests,
  );
  expect(combat.webpEntries.length, "combat-transition WebP request budget").toBeLessThanOrEqual(
    budget.maxCombatWebpRequests,
  );
  expect(combat.decodedBodyBytes, "combat-transition decoded resource body budget").toBeLessThanOrEqual(
    budget.maxCombatDecodedBodyBytes,
  );
});
