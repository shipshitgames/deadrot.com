#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_APPS } from "../packages/catalog/index.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(rootDir, ".artifacts", "proof-tours");
const defaultPortBase = GAME_APPS[0]?.devPort ?? 5174;

const IGNORED_CONSOLE_ERRORS = {
  "scourge-survivors": [/WebSocket connection to .*localhost:1999/i, /net::ERR_CONNECTION_REFUSED/i],
  warline: [/WebSocket connection to .*localhost:1999/i, /net::ERR_CONNECTION_REFUSED/i],
};

const SURFACES = {
  brawl: ".brawl-canvas",
  deadlane: "#scene",
  pactfall: "#scene",
  redline: "#scene",
  rothulk: "#scene",
  "scourge-survivors": '[data-testid="game-canvas"]',
  starblight: "#scene",
};

const RECIPES = {
  async brawl({ page, capture }) {
    await page.goto("/");
    await page.getByRole("heading", { name: "Brawl" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => Boolean(window.__brawlGame && window.__brawlSnapshot));
    await capture("menu");

    await page.getByRole("button", { name: "Fight" }).click();
    await page.waitForFunction(() => window.__brawlSnapshot?.().status === "playing");
    await capture("active-fight");

    await page.evaluate(() => window.__brawlGame.command("special"));
    await page.waitForTimeout(250);
    await capture("special-command");
    return page.evaluate(() => window.__brawlSnapshot());
  },

  async deadlane({ page, capture }) {
    await page.addInitScript(() => {
      Element.prototype.requestPointerLock = () => Promise.resolve();
    });
    await page.goto("/");
    await page.getByText("Gold", { exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => Boolean(window.__deadlaneGame));
    await capture("splash");

    const enterPrompt = page.getByText("Press Enter to continue");
    await enterPrompt.click();
    await page.getByRole("button", { name: "DEPLOY" }).waitFor({ state: "visible" });
    await capture("menu");

    await page.getByRole("button", { name: "DEPLOY" }).click();
    await page.locator("#hud-banner").waitFor({ state: "attached" });
    await page.waitForTimeout(300);
    await capture("deployed");
    return page.evaluate(() => window.__deadlaneGame.snapshot());
  },

  async pactfall({ page, capture }) {
    await page.goto("/");
    await page.locator("#meter-base-friendly").waitFor({ state: "visible" });
    await page.locator("#arena-name").waitFor({ state: "visible" });
    await capture("loaded");

    await clickCenter(page, "#scene");
    await page.waitForTimeout(350);
    await capture("lane-contact");

    await page.keyboard.press("KeyQ");
    await page.waitForTimeout(300);
    await capture("ability-input");
    return page.evaluate(() => window.__pactfallSnapshot?.() ?? null);
  },

  async redline({ page, capture }) {
    await page.goto("/");
    await page.getByText("Pyre Courier Run").waitFor({ state: "visible" });
    await capture("menu");

    await page.getByRole("button", { name: "IGNITE" }).click();
    await page.locator("#overlay").waitFor({ state: "attached" });
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(500);
    await capture("redline-run");

    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    await capture("jump");
    return page.evaluate(() => window.__REDLINE__?.snapshot?.() ?? null);
  },

  async rothulk({ page, capture }) {
    await page.goto("/");
    await page.getByText("ROTHULK").waitFor({ state: "visible" });
    await page.waitForFunction(() => Boolean(window.__rothulkGame));
    await capture("splash");

    const enterPrompt = page.getByText("Press Enter to continue");
    await enterPrompt.click();
    await page.getByRole("button", { name: /^Breach\b/i }).waitFor({ state: "visible" });
    await capture("menu");

    await page.getByRole("button", { name: /^Breach\b/i }).click();
    await page.waitForFunction(() => window.__rothulkGame?.debugSnapshot?.().mode === "playing");
    await capture("breach-run");
    return page.evaluate(() => window.__rothulkGame.debugSnapshot());
  },

  async "scourge-survivors"({ page, capture }) {
    await page.goto("/?sandbox=1");
    await page.getByText("Scourge Labs").waitFor({ state: "visible" });
    await page.waitForFunction(() => Boolean(window.__fpsGame && window.__hudSnapshot));
    await capture("labs");

    await page.getByRole("button", { name: /runtime assets/i }).click();
    await page
      .locator("figcaption")
      .filter({ hasText: /^Pistol$/ })
      .waitFor({ state: "visible" });
    await capture("runtime-assets");

    await page.evaluate(() => window.__fpsGame.spawnSandboxEnemy("melee", 6));
    await page.waitForFunction(() => window.__hudSnapshot?.().enemiesAlive >= 6);
    await capture("spawned-foes");
    return page.evaluate(() => window.__hudSnapshot());
  },

  async starblight({ page, capture }) {
    await page.goto("/");
    await page.getByText("STARBLIGHT").waitFor({ state: "visible" });
    await capture("splash");

    const enterPrompt = page.getByText("Press Enter to continue");
    await enterPrompt.click();
    await page.getByRole("button", { name: /^Upgrades\b/i }).waitFor({ state: "visible" });
    await capture("menu");

    await page.getByRole("button", { name: "ENGAGE" }).click();
    await page.locator("#banner").waitFor({ state: "attached" });
    await page.waitForTimeout(500);
    await capture("engaged");
    return readHudText(page, ["#level", "#kills", "#int-text"]);
  },

  async warline({ page, capture }) {
    await page.goto("/");
    await page.getByRole("heading", { name: "WARLINE" }).waitFor({ state: "visible" });
    await capture("splash");

    const enterPrompt = page.getByText("Press Enter to continue");
    await enterPrompt.click();
    await page.getByRole("button", { name: /^Command Table\b/i }).waitFor({ state: "visible" });
    await capture("menu");

    await page.getByRole("button", { name: /^Command Table\b/i }).click();
    await page.getByRole("heading", { name: "The Front" }).waitFor({ state: "visible" });
    await capture("front");
    return readHudText(page, ["body"]);
  },
};

const options = parseOptions(process.argv.slice(2));
const selectedGames = selectGames(options);
const portBase = parsePortBase(process.env.PROOF_PORT_BASE);
const portOffset = portBase - defaultPortBase;
const reuseServers = process.env.PROOF_REUSE_SERVERS === "1";

await mkdir(artifactRoot, { recursive: true });

if (options.list) {
  for (const game of GAME_APPS) console.log(`${game.slug}\t${game.title}\t${game.devPort + portOffset}`);
  process.exit(0);
}

const { chromium } = await import("@playwright/test");
const generatedAt = new Date().toISOString();
const results = [];
let hasFailures = false;

for (const game of selectedGames) {
  const result = await runGame(game);
  results.push(result);
  hasFailures ||= !result.ok;
  const mark = result.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${game.slug} -> ${path.relative(rootDir, result.markdownAnchor)}`);
}

const summary = {
  generatedAt,
  command: "bun run proof:tours",
  selectedSlugs: selectedGames.map((game) => game.slug),
  artifactRoot: path.relative(rootDir, artifactRoot),
  results,
};

const reportJson = path.join(artifactRoot, "report.json");
const reportMd = path.join(artifactRoot, "report.md");
await writeFile(reportJson, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(reportMd, renderMarkdown(summary));

console.log(`Proof tour report: ${path.relative(rootDir, reportMd)}`);
if (hasFailures) process.exitCode = 1;

async function runGame(game) {
  const slug = game.slug;
  const port = game.devPort + portOffset;
  const baseURL = `http://127.0.0.1:${port}`;
  const gameDir = path.join(artifactRoot, slug);
  await mkdir(gameDir, { recursive: true });

  const server = reuseServers ? null : startServer(slug, port);
  const consoleErrors = [];
  const ignoredConsoleErrors = [];
  const pageErrors = [];
  const screenshots = [];
  const startedAt = Date.now();
  let browser;
  let readyState = null;
  let nonblank = null;
  let error = null;

  try {
    await waitForUrl(baseURL, { label: slug });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ baseURL, viewport: { width: 1280, height: 720 } });
    const ignoredPatterns = IGNORED_CONSOLE_ERRORS[slug] ?? [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (ignoredPatterns.some((pattern) => pattern.test(text))) {
        ignoredConsoleErrors.push(text);
      } else {
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (pageError) => pageErrors.push(String(pageError)));

    const capture = async (name) => {
      const index = String(screenshots.length + 1).padStart(2, "0");
      const filename = `${index}-${safeName(name)}.png`;
      const filePath = path.join(gameDir, filename);
      await page.screenshot({ path: filePath });
      screenshots.push(path.relative(rootDir, filePath));
    };

    readyState = await RECIPES[slug]({ page, capture });
    nonblank = await probeNonblank(page, SURFACES[slug]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    await browser?.close();
    await stopServer(server);
  }

  const ok = !error && pageErrors.length === 0 && consoleErrors.length === 0 && Boolean(nonblank?.ok);
  const markdownAnchor = path.join(artifactRoot, "report.md");
  return {
    slug,
    title: game.title,
    url: baseURL,
    ok,
    durationMs: Date.now() - startedAt,
    readyState,
    nonblank,
    screenshots,
    consoleErrors,
    ignoredConsoleErrors,
    pageErrors,
    error,
    markdownAnchor,
  };
}

function startServer(slug, port) {
  const child = spawn(
    "bun",
    ["run", "--cwd", `apps/games/${slug}`, "dev", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        BROWSER: "none",
        FORCE_COLOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.proofTourStopping = false;
  child.stdout.on("data", (chunk) => {
    if (!child.proofTourStopping) process.stdout.write(`[${slug}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    if (!child.proofTourStopping) process.stderr.write(`[${slug}] ${chunk}`);
  });
  return child;
}

async function stopServer(server) {
  if (!server || server.killed) return;
  server.proofTourStopping = true;
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForUrl(url, { label }) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 120_000) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (caught) {
      lastError = caught;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} dev server at ${url}: ${lastError?.message ?? "no response"}`);
}

async function clickCenter(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Cannot click center of missing selector: ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function readHudText(page, selectors) {
  const entries = await Promise.all(
    selectors.map(async (selector) => [
      selector,
      await page
        .locator(selector)
        .first()
        .textContent()
        .catch(() => null),
    ]),
  );
  return Object.fromEntries(entries);
}

async function probeNonblank(page, selector) {
  const target = selector && (await page.locator(selector).count()) > 0 ? page.locator(selector).first() : page;
  const buffer = await target.screenshot({ timeout: 10_000 });
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  const ok = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();

    const probe = document.createElement("canvas");
    probe.width = 96;
    probe.height = Math.max(1, Math.round((image.height / image.width) * probe.width));
    const context = probe.getContext("2d", { willReadFrequently: true });
    if (!context) return false;

    context.drawImage(image, 0, 0, probe.width, probe.height);
    const data = context.getImageData(0, 0, probe.width, probe.height).data;
    let painted = 0;
    let varied = 0;
    let firstIntensity = null;

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

    return painted > 120 && varied > 20;
  }, dataUrl);
  return {
    selector: selector ?? "page",
    ok,
  };
}

function parseOptions(argv) {
  const options = { list: false, slugs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") {
      options.list = true;
    } else if (arg === "--slug" || arg === "--slugs") {
      options.slugs.push(...splitSlugs(argv[index + 1] ?? ""));
      index += 1;
    } else if (arg?.startsWith("--slug=") || arg?.startsWith("--slugs=")) {
      options.slugs.push(...splitSlugs(arg.split("=").slice(1).join("=")));
    } else if (arg && !arg.startsWith("-")) {
      options.slugs.push(...splitSlugs(arg));
    }
  }
  options.slugs.push(...splitSlugs(process.env.PROOF_GAME_SLUGS ?? ""));
  return options;
}

function splitSlugs(value) {
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function selectGames(options) {
  if (!options.slugs.length) return GAME_APPS;
  const known = new Map(GAME_APPS.map((game) => [game.slug, game]));
  const unknown = options.slugs.filter((slug) => !known.has(slug));
  if (unknown.length) throw new Error(`Unknown proof-tour slug(s): ${unknown.join(", ")}`);
  return [...new Set(options.slugs)].map((slug) => known.get(slug));
}

function parsePortBase(value) {
  if (!value?.trim()) return defaultPortBase;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_529) {
    throw new Error(`PROOF_PORT_BASE must be an integer from 1024 to 65529. Received: ${value}`);
  }
  return port;
}

function renderMarkdown(summary) {
  const lines = [
    "# Deadrot Playable Proof Tours",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "| Game | Result | Nonblank | Screenshots | Errors |",
    "| --- | --- | --- | ---: | ---: |",
  ];

  for (const result of summary.results) {
    lines.push(
      `| ${result.title} | ${result.ok ? "PASS" : "FAIL"} | ${result.nonblank?.ok ? "PASS" : "FAIL"} | ${
        result.screenshots.length
      } | ${result.consoleErrors.length + result.pageErrors.length + (result.error ? 1 : 0)} |`,
    );
  }

  for (const result of summary.results) {
    lines.push("", `## ${result.title}`, "", `URL: ${result.url}`, "", `Result: ${result.ok ? "PASS" : "FAIL"}`);
    lines.push("", "Screenshots:");
    for (const screenshot of result.screenshots) lines.push(`- \`${screenshot}\``);
    lines.push("", "Ready State:", "", "```json", JSON.stringify(result.readyState, null, 2), "```");
    lines.push("", "Nonblank Probe:", "", "```json", JSON.stringify(result.nonblank, null, 2), "```");
    if (result.error || result.consoleErrors.length || result.pageErrors.length) {
      lines.push("", "Failures:", "", "```json");
      lines.push(
        JSON.stringify(
          {
            error: result.error,
            consoleErrors: result.consoleErrors,
            pageErrors: result.pageErrors,
          },
          null,
          2,
        ),
      );
      lines.push("```");
    }
    if (result.ignoredConsoleErrors.length) {
      lines.push("", "Ignored Console Noise:", "", "```json");
      lines.push(JSON.stringify(result.ignoredConsoleErrors, null, 2));
      lines.push("```");
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function safeName(name) {
  return name
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
