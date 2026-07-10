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
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
};

type ResourceSnapshot = {
  entries: BrowserResource[];
  webpEntries: BrowserResource[];
  streamingMediaEntries: BrowserResource[];
  transferBytes: number;
  encodedBodyBytes: number;
  decodedBodyBytes: number;
  budgetedDecodedBodyBytes: number;
  streamingMediaDecodedBodyBytes: number;
  webpTransferBytes: number;
  webpEncodedBodyBytes: number;
  webpDecodedBodyBytes: number;
};

const budget = assetBudgets.games["scourge-survivors"] as BrowserBudget;
const RESOURCE_QUIET_MS = 2_000;
const RESOURCE_SETTLE_TIMEOUT_MS = 45_000;

const ALLOWED_BOOT_STREAMING_MEDIA_BASENAMES = [/^ash-reactor-[^.]+\.webm$/];
const ALLOWED_COMBAT_STREAMING_MEDIA_BASENAMES = [/^ash-reactor-[^.]+\.webm$/, /^blood-circuit-ascension-[^.]+\.webm$/];

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
  const entries = await page.evaluate(() =>
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) => new URL(entry.name).origin === window.location.origin)
      .map((entry) => ({
        pathname: new URL(entry.name).pathname,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      })),
  );

  return buildResourceSnapshot(entries);
}

function basename(pathname: string): string {
  return decodeURIComponent(pathname.split("/").at(-1) ?? pathname);
}

function isStreamingMedia(entry: BrowserResource): boolean {
  return entry.initiatorType === "audio" || entry.initiatorType === "video";
}

function buildResourceSnapshot(entries: BrowserResource[]): ResourceSnapshot {
  const webpEntries = entries.filter((entry) => entry.pathname.endsWith(".webp"));
  const streamingMediaEntries = entries.filter(isStreamingMedia);
  const budgetedEntries = entries.filter((entry) => !isStreamingMedia(entry));
  const sum = (resources: BrowserResource[], field: "transferSize" | "encodedBodySize" | "decodedBodySize") =>
    resources.reduce((total, entry) => total + entry[field], 0);

  return {
    entries,
    webpEntries,
    streamingMediaEntries,
    transferBytes: sum(entries, "transferSize"),
    encodedBodyBytes: sum(entries, "encodedBodySize"),
    decodedBodyBytes: sum(entries, "decodedBodySize"),
    // Chromium reports an HTMLMediaElement's decodedBodySize as zero, the
    // current range, or the entire media file depending on playback timing.
    // Keep those requests in every count and in the raw diagnostics, but apply
    // the body ceiling to deterministic resources. assets:check independently
    // enforces the shipped file-size ceiling for the explicitly allowed tracks.
    budgetedDecodedBodyBytes: sum(budgetedEntries, "decodedBodySize"),
    streamingMediaDecodedBodyBytes: sum(streamingMediaEntries, "decodedBodySize"),
    webpTransferBytes: sum(webpEntries, "transferSize"),
    webpEncodedBodyBytes: sum(webpEntries, "encodedBodySize"),
    webpDecodedBodyBytes: sum(webpEntries, "decodedBodySize"),
  };
}

function resourceDelta(before: ResourceSnapshot, after: ResourceSnapshot): ResourceSnapshot {
  return buildResourceSnapshot(after.entries.slice(before.entries.length));
}

function unexpectedStreamingMedia(snapshot: ResourceSnapshot, allowedBasenames: RegExp[]): string[] {
  return snapshot.streamingMediaEntries
    .map((entry) => basename(entry.pathname))
    .filter((name) => !allowedBasenames.some((pattern) => pattern.test(name)));
}

function logSnapshot(phase: string, snapshot: ResourceSnapshot): void {
  console.log(
    JSON.stringify({
      phase,
      resourceRequests: snapshot.entries.length,
      transferBytes: snapshot.transferBytes,
      encodedBodyBytes: snapshot.encodedBodyBytes,
      decodedBodyBytes: snapshot.decodedBodyBytes,
      budgetedDecodedBodyBytes: snapshot.budgetedDecodedBodyBytes,
      streamingMediaRequests: snapshot.streamingMediaEntries.length,
      streamingMediaDecodedBodyBytes: snapshot.streamingMediaDecodedBodyBytes,
      webpRequests: snapshot.webpEntries.length,
      webpTransferBytes: snapshot.webpTransferBytes,
      webpEncodedBodyBytes: snapshot.webpEncodedBodyBytes,
      webpDecodedBodyBytes: snapshot.webpDecodedBodyBytes,
    }),
  );
}

test("HTML media buffering stays diagnostic without excluding fetched audio", () => {
  const deterministicEntries: BrowserResource[] = [
    {
      pathname: "/assets/app.js",
      initiatorType: "script",
      transferSize: 1_000,
      encodedBodySize: 1_000,
      decodedBodySize: 2_000,
    },
    {
      pathname: "/assets/shotgun.webm",
      initiatorType: "fetch",
      transferSize: 5_000,
      encodedBodySize: 5_000,
      decodedBodySize: 5_000,
    },
  ];
  const musicEntry: BrowserResource = {
    pathname: "/assets/ash-reactor.webm",
    initiatorType: "audio",
    transferSize: 9_494,
    encodedBodySize: 9_494,
    decodedBodySize: 9_494,
  };
  const partialMedia = buildResourceSnapshot([...deterministicEntries, musicEntry]);
  const fullyBufferedMedia = buildResourceSnapshot([
    ...deterministicEntries,
    {
      ...musicEntry,
      transferSize: 3_745_046,
      encodedBodySize: 3_745_046,
      decodedBodySize: 3_745_046,
    },
  ]);

  expect(partialMedia.budgetedDecodedBodyBytes).toBe(7_000);
  expect(fullyBufferedMedia.budgetedDecodedBodyBytes).toBe(partialMedia.budgetedDecodedBodyBytes);
  expect(fullyBufferedMedia.decodedBodyBytes).toBeGreaterThan(partialMedia.decodedBodyBytes);
  expect(fullyBufferedMedia.streamingMediaEntries).toHaveLength(1);
});

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
  const unexpectedBootMedia = unexpectedStreamingMedia(beforeCombat, ALLOWED_BOOT_STREAMING_MEDIA_BASENAMES);
  logSnapshot("menu-pre-combat", beforeCombat);

  expect(forbiddenBootAssets, `combat WebPs requested before combat: ${forbiddenBootAssets.join(", ")}`).toEqual([]);
  expect(
    unexpectedBootMedia,
    `unexpected streaming media requested before combat: ${unexpectedBootMedia.join(", ")}`,
  ).toEqual([]);
  expect(beforeCombat.entries.length, "pre-combat resource request budget").toBeLessThanOrEqual(
    budget.maxBootResourceRequests,
  );
  expect(beforeCombat.webpEntries.length, "pre-combat WebP request budget").toBeLessThanOrEqual(
    budget.maxBootWebpRequests,
  );
  expect(beforeCombat.budgetedDecodedBodyBytes, "pre-combat decoded resource body budget").toBeLessThanOrEqual(
    budget.maxBootDecodedBodyBytes,
  );

  await page.getByRole("button", { name: /^Play a Run$/i }).click();
  const combatAssetLoading = page.getByTestId("combat-asset-loading");
  await expect(combatAssetLoading).toBeVisible();
  await expect(combatAssetLoading).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId("combat-asset-error")).toHaveCount(0);
  await settleResourceTimings(page);

  const afterCombat = await resourceSnapshot(page);
  const combat = resourceDelta(beforeCombat, afterCombat);
  const unexpectedCombatMedia = unexpectedStreamingMedia(combat, ALLOWED_COMBAT_STREAMING_MEDIA_BASENAMES);
  logSnapshot("combat-transition", combat);

  expect(
    unexpectedCombatMedia,
    `unexpected streaming media requested during combat transition: ${unexpectedCombatMedia.join(", ")}`,
  ).toEqual([]);
  expect(combat.entries.length, "combat transition must load at least one resource").toBeGreaterThan(0);
  expect(combat.webpEntries.length, "combat transition must load at least one WebP payload").toBeGreaterThan(0);
  expect(combat.budgetedDecodedBodyBytes, "combat transition must load a non-empty resource body").toBeGreaterThan(0);
  expect(combat.entries.length, "combat-transition resource request budget").toBeLessThanOrEqual(
    budget.maxCombatResourceRequests,
  );
  expect(combat.webpEntries.length, "combat-transition WebP request budget").toBeLessThanOrEqual(
    budget.maxCombatWebpRequests,
  );
  expect(combat.budgetedDecodedBodyBytes, "combat-transition decoded resource body budget").toBeLessThanOrEqual(
    budget.maxCombatDecodedBodyBytes,
  );
});
