import { readdirSync } from "node:fs";
import path from "node:path";
import { GAME_APPS } from "@deadrot/catalog";
import { expect, type Page, test } from "@playwright/test";
import type { GameSlug } from "./game-catalog";

interface GameSpec {
  path: string;
  assertLoaded: (page: Page) => Promise<void>;
  exercise: (page: Page) => Promise<void>;
  canvasSelector?: string;
  ignoredConsoleErrors?: RegExp[];
  // Games whose title screen sits behind the shared "press Enter to continue"
  // splash (useEnterToReveal): the menu nav only mounts after the gate is
  // dismissed, so the test must reveal it before asserting the start controls.
  entersFromSplash?: boolean;
}

const gameSpecs: Record<GameSlug, GameSpec> = {
  deadlane: {
    path: "/",
    canvasSelector: "#scene",
    entersFromSplash: true,
    async assertLoaded(page) {
      await expect(page.getByText("Gold", { exact: true })).toBeVisible();
      await expect(page.getByText("Wave", { exact: true })).toBeVisible();
      await expect(page.getByText("Base HP", { exact: true })).toBeVisible();
    },
    async exercise(page) {
      await page.getByRole("button", { name: "DEPLOY" }).click();
      await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);
      await expect(page.locator("#hint-text")).toContainText(/PRESS E OR CLICK|MOVE TO TILE|LOOK AT A BUILD TILE/);
    },
  },
  pactfall: {
    path: "/",
    canvasSelector: "#scene",
    async assertLoaded(page) {
      await expect(page.getByText("PYRE BASE", { exact: true })).toBeVisible();
      await expect(page.getByText("WARDEN BASE", { exact: true })).toBeVisible();
      await expect(page.getByText("SCOURGE BUFF", { exact: true })).toBeVisible();
      await expect(page.locator("#arena-name")).not.toBeEmpty();
    },
    async exercise(page) {
      const box = await page.locator("#scene").boundingBox();
      expect(box).not.toBeNull();
      await page.locator("#scene").dispatchEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2),
        clientY: Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2),
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      });
      await expect(page.locator("#meter-hp .bar i")).toHaveAttribute("style", /width:/);
    },
  },
  redline: {
    path: "/",
    canvasSelector: "#scene",
    // No entersFromSplash: redline's overlay is rendered imperatively by the
    // engine (showStart), which paints the Ignite card directly — no React
    // "press Enter" splash to dismiss.
    async assertLoaded(page) {
      await expect(page.getByText("Pyre Courier Run")).toBeVisible();
      await expect(page.locator("#hud-speed")).toBeVisible();
      await expect(page.locator("#hud-dist")).toBeVisible();
    },
    async exercise(page) {
      await page.getByRole("button", { name: "IGNITE" }).click();
      await expect(page.locator("#overlay")).toHaveClass(/is-hidden/);
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(250);
      await page.keyboard.up("ArrowRight");
      await expect.poll(() => page.locator("#hud-time").textContent()).not.toBe("0.00");
    },
  },
  rothulk: {
    path: "/",
    canvasSelector: "#scene",
    entersFromSplash: true,
    async assertLoaded(page) {
      await expect(page.getByText("ROTHULK")).toBeVisible();
      await expect(page.locator("#hud-lives")).toHaveText("x3");
    },
    async exercise(page) {
      await page.getByRole("button", { name: /^Breach\b/i }).click();
      // The title screen unmounts once the run begins (it is gated on !started).
      await expect(page.locator("#banner")).toHaveCount(0);
      await expect(page.locator("#hud-obj")).toContainText("REACH");
      await page.waitForFunction(() => Boolean((window as unknown as { __rothulkGame?: unknown }).__rothulkGame));

      await page.evaluate(() => {
        (window as unknown as { __rothulkGame: { teleportToCore: () => void } }).__rothulkGame.teleportToCore();
      });
      await expect.poll(() => rothulkSnapshot(page, "phase")).toBe("escape");
      await expect(page.locator("#hud-obj")).toContainText("ESCAPE");

      await page.evaluate(() => {
        (window as unknown as { __rothulkGame: { teleportToExit: () => void } }).__rothulkGame.teleportToExit();
      });
      await expect.poll(() => rothulkSnapshot(page, "mode")).toBe("won");
      await expect(page.locator("#toast")).toContainText("HULK SEVERED");
    },
  },
  "scourge-survivors": {
    path: "/?sandbox=1",
    canvasSelector: '[data-testid="game-canvas"]',
    async assertLoaded(page) {
      await expect(page.getByText("Scourge Labs")).toBeVisible();
      await expect(page.getByTestId("game-canvas")).toBeVisible();
      await page.waitForFunction(() => {
        const win = window as unknown as { __fpsGame?: unknown; __hudSnapshot?: () => unknown };
        return Boolean(win.__fpsGame && win.__hudSnapshot);
      });
    },
    async exercise(page) {
      const snapshot = await page.evaluate(() => {
        return (window as unknown as { __hudSnapshot: () => { sandbox: boolean; status: string } }).__hudSnapshot();
      });
      expect(snapshot).toMatchObject({
        sandbox: true,
        status: "pointerlock-needed",
      });
      await page.getByRole("button", { name: /runtime assets/i }).click();
      await expect(page.locator("figcaption").filter({ hasText: /^Pistol$/ })).toBeVisible();
      await expect(page.locator("figcaption").filter({ hasText: /^Boss front$/ })).toBeVisible();
    },
  },
  starblight: {
    path: "/",
    canvasSelector: "#scene",
    entersFromSplash: true,
    async assertLoaded(page) {
      await expect(page.getByText("STARBLIGHT")).toBeVisible();
      await expect(page.locator("#int-text")).toContainText("100/100");
    },
    async exercise(page) {
      // The hero title hides once the menu is revealed (it stays mounted for the
      // engine-written game-over banner, which reuses #banner-title).
      await expect(page.locator("#banner-title")).toBeHidden();
      // The Drydock (meta-upgrade shop) opens from the Upgrades action and lists upgrades.
      await page.getByRole("button", { name: /^Upgrades\b/i }).click();
      await expect(page.getByText("REINFORCED FRAME")).toBeVisible();
      await page.getByRole("button", { name: /^Back\b/i }).click();
      await expect(page.getByText("REINFORCED FRAME")).toBeHidden();
      await page.getByRole("button", { name: "ENGAGE" }).click();
      await expect(page.locator("#banner")).toHaveClass(/hidden/);
      await expect(page.locator("#level")).toHaveText("1");
      await expect(page.locator("#kills")).toContainText("0 kills");
    },
  },
  warline: {
    path: "/",
    entersFromSplash: true,
    ignoredConsoleErrors: [/WebSocket connection to .*localhost:1999/i],
    async assertLoaded(page) {
      // Title splash: the strategic-command hero is up before the menu reveal.
      await expect(page.getByRole("heading", { name: "WARLINE" })).toBeVisible();
      await expect(page.getByText("Strategic Command")).toBeVisible();
    },
    async exercise(page) {
      // Menu was revealed above; take the Command Table into the war room and
      // confirm the front map + feed mount.
      await page.getByRole("button", { name: /^Command Table\b/i }).click();
      await expect(page.getByRole("heading", { name: "The Front" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "War Feed" })).toBeVisible();
      await expect(page.getByRole("img", { name: "War map of the front" })).toBeVisible();
    },
  },
};

test.beforeAll(() => {
  const shippedGameSlugs = readdirSync(path.resolve("apps/games"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const configuredGameSlugs = GAME_APPS.map((game) => game.slug).sort();
  const testedGameSlugs = Object.keys(gameSpecs).sort();

  expect(configuredGameSlugs).toEqual(shippedGameSlugs);
  expect(testedGameSlugs).toEqual(shippedGameSlugs);
});

test("boots and responds to core controls", async ({ page }, testInfo) => {
  const slug = gameSlugFromProject(testInfo.project.name);
  const spec = gameSpecs[slug];
  expect(spec, `No E2E game spec found for project ${slug}`).toBeTruthy();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(spec.path);

  // Assert the title screen booted while the splash is still up — the hero copy
  // (title, kicker) is only visible before the menu is revealed.
  await spec.assertLoaded(page);

  // Dismiss the shared "press Enter to continue" splash so the menu nav
  // (Deploy/Engage/…) mounts; the start controls are exercised below. Reveal by
  // *clicking* the prompt rather than pressing Enter — useEnterToReveal does not
  // stopPropagation, so an Enter/Space keypress also reaches game input systems
  // that treat it as "confirm/start" and would auto-launch the run.
  if (spec.entersFromSplash) {
    const enterPrompt = page.getByText("Press Enter to continue");
    await expect(enterPrompt).toBeVisible();
    await enterPrompt.click();
    await expect(enterPrompt).toBeHidden();
  }

  if (spec.canvasSelector) {
    await expectCanvasToRender(page, spec.canvasSelector);
  }
  await expectNoBrokenImages(page);

  await spec.exercise(page);

  const ignored = spec.ignoredConsoleErrors ?? [];
  const unexpectedConsoleErrors = consoleErrors.filter((message) => !ignored.some((pattern) => pattern.test(message)));
  expect(pageErrors).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});

function gameSlugFromProject(projectName: string): GameSlug {
  return projectName.split(":")[0] as GameSlug;
}

async function expectCanvasToRender(page: Page, selector: string) {
  const canvas = page.locator(selector).first();
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => {
      const image = await canvas.screenshot();
      const dataUrl = `data:image/png;base64,${image.toString("base64")}`;
      return page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();

        const probe = document.createElement("canvas");
        probe.width = 64;
        probe.height = Math.max(1, Math.round((image.height / image.width) * probe.width));
        const context = probe.getContext("2d", { willReadFrequently: true });
        if (!context) return false;

        context.drawImage(image, 0, 0, probe.width, probe.height);
        const data = context.getImageData(0, 0, probe.width, probe.height).data;
        let painted = 0;
        let varied = 0;
        let firstIntensity: number | null = null;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index] ?? 0;
          const green = data[index + 1] ?? 0;
          const blue = data[index + 2] ?? 0;
          const alpha = data[index + 3] ?? 0;
          const intensity = red + green + blue;

          if (alpha > 0 && intensity > 8) {
            painted += 1;
            firstIntensity ??= intensity;
            if (Math.abs(intensity - firstIntensity) > 10) varied += 1;
          }
        }

        return painted > 80 && varied > 10;
      }, dataUrl);
    })
    .toBe(true);
}

async function expectNoBrokenImages(page: Page) {
  const brokenImages = await page.$$eval("img", (images) =>
    images
      .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => image.currentSrc || image.src),
  );
  expect(brokenImages).toEqual([]);
}

async function rothulkSnapshot(page: Page, field: "mode" | "phase") {
  return page.evaluate((key) => {
    const game = (
      window as unknown as {
        __rothulkGame: {
          debugSnapshot: () => {
            mode: string;
            phase: string;
          };
        };
      }
    ).__rothulkGame;
    return game.debugSnapshot()[key];
  }, field);
}
