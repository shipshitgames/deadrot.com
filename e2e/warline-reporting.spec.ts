import { expect, type Page, test } from "@playwright/test";

// Cross-game Warline reporting — the wiring this PR ships. Every game now calls
// `reportWarlineOperation(slug, run)` from `@deadrot/game-kit/warline` once per
// run, beside its `recordWarResult(...)`. The mapping itself (faction default,
// score clamp, transport) is unit-tested across every slug in game-kit; this
// spec proves the END-TO-END wiring inside a real game build:
//
//   1. a finished run POSTs a nonce-bearing claim to the same-origin broker
//      without a browser credential, and
//   2. an explicitly disabled broker stays a silent no-op.
//
// Rothulk is the vehicle: it exposes a debug handle (`window.__rothulkGame`)
// with teleport helpers, so a deterministic victory is one evaluate() away —
// the same handle the shared games.spec already drives to a win.

interface ReportPayload {
  result: {
    game: string;
    faction: string;
    outcome: string;
    score: number;
    nonce: string;
  };
}

const REPORT_GLOB = "**/api/warline/report";

test.describe("Warline cross-game operation reporting", () => {
  test("a finished run submits its OperationResult to the credential-free browser broker", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("rothulk:"), "Driven through Rothulk's debug handle.");

    const reports: ReportPayload[] = [];
    let authorizationSeen = false;
    await page.route(REPORT_GLOB, async (route) => {
      if (route.request().method() === "POST") {
        reports.push(route.request().postDataJSON() as ReportPayload);
        authorizationSeen ||= route.request().headers().authorization !== undefined;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    // Point the reporter at the same-origin broker before game code runs and
    // pick the Pyre allegiance so we can assert it round-trips.
    await page.addInitScript(() => {
      (globalThis as { __warlineReporter?: { reportEndpoint: string } }).__warlineReporter = {
        reportEndpoint: "/api/warline/report",
      };
      try {
        localStorage.setItem("warline.faction", "pyre");
      } catch {
        // localStorage may be unavailable before navigation in some engines.
      }
    });

    await boot(page);
    await forceVictory(page);

    await expect.poll(() => reports.length, { timeout: 8000 }).toBeGreaterThan(0);
    const report = reports[0];
    expect(report?.result.game).toBe("rothulk");
    expect(report?.result.outcome).toBe("victory");
    expect(report?.result.faction).toBe("pyre");
    expect(typeof report?.result.score).toBe("number");
    expect(report?.result.score).toBeGreaterThanOrEqual(0);
    expect(report?.result.nonce).toMatch(/^[A-Za-z0-9][A-Za-z0-9:_-]{15,127}$/);
    expect(authorizationSeen).toBe(false);
  });

  test("an explicitly disabled broker never fires a report and never breaks the run", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("rothulk:"), "Driven through Rothulk's debug handle.");

    let posted = false;
    await page.route(REPORT_GLOB, async (route) => {
      if (route.request().method() === "POST") posted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    // An explicit empty broker endpoint disables reporting regardless of build config.
    await page.addInitScript(() => {
      (globalThis as { __warlineReporter?: { reportEndpoint: string } }).__warlineReporter = {
        reportEndpoint: "",
      };
    });

    await boot(page);
    await forceVictory(page);

    // The run still reaches victory (forceVictory asserts mode === "won"); no
    // report ever leaves the browser.
    expect(posted).toBe(false);
  });
});

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.getByText("ROTHULK")).toBeVisible();
  await page.getByText("Press Enter to continue").click();
  await page.getByRole("button", { name: /^Breach\b/i }).click();
  await page.waitForFunction(() => {
    const game = (window as unknown as { __rothulkGame?: { debugSnapshot: () => { mode: string } } }).__rothulkGame;
    return game?.debugSnapshot().mode === "playing";
  });
}

// Mirror the proven two-step win from games.spec: reach the core (ignites it →
// "escape" phase), then reach the armed exit (→ "won"). The win path is where
// `reportWarlineOperation("rothulk", { outcome: "victory", ... })` fires.
async function forceVictory(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __rothulkGame: { teleportToCore: () => void } }).__rothulkGame.teleportToCore();
  });
  await expect.poll(() => snapshotField(page, "phase")).toBe("escape");

  await page.evaluate(() => {
    (window as unknown as { __rothulkGame: { teleportToExit: () => void } }).__rothulkGame.teleportToExit();
  });
  await expect.poll(() => snapshotField(page, "mode")).toBe("won");
}

async function snapshotField(page: Page, field: "mode" | "phase"): Promise<string> {
  return page.evaluate((key) => {
    const game = (window as unknown as { __rothulkGame?: { debugSnapshot: () => Record<string, unknown> } })
      .__rothulkGame;
    return String(game?.debugSnapshot()[key] ?? "");
  }, field);
}
