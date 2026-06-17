#!/usr/bin/env node

import { GAME_APPS } from "../packages/catalog/index.js";

const webPort = parsePort(process.env.DEADROT_DEMO_WEB_PORT, 3000, "DEADROT_DEMO_WEB_PORT");
const apiPort = parsePort(process.env.DEADROT_DEMO_API_PORT, 3004, "DEADROT_DEMO_API_PORT");
const selectedGames = parseGameSelection(process.env.DEMO_GAME_SLUGS);

const checks = [
  { id: "web", url: `http://127.0.0.1:${webPort}`, okStatuses: [200] },
  { id: "api-live", url: `http://127.0.0.1:${apiPort}/health/live`, okStatuses: [200] },
  { id: "api-ready", url: `http://127.0.0.1:${apiPort}/health/ready`, okStatuses: [200, 503], degradedStatuses: [503] },
  ...selectedGames.map((game) => ({
    id: game.slug,
    url: `http://127.0.0.1:${game.devPort}`,
    okStatuses: [200],
  })),
];

const results = [];
for (const check of checks) results.push(await runCheck(check));

let failed = false;
for (const result of results) {
  const mark = result.ok ? (result.degraded ? "DEGRADED" : "PASS") : "FAIL";
  console.log(`${mark} ${result.id} ${result.url} ${result.status ?? result.error ?? ""}`.trim());
  if (result.bodyStatus) console.log(`  status: ${result.bodyStatus}`);
  if (!result.ok) failed = true;
}

if (failed) {
  console.error("");
  console.error("Demo smoke failed. Start the stack with `bun run demo:dev` and check the failed URL above.");
  process.exitCode = 1;
}

async function runCheck(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(check.url, { signal: controller.signal });
    const degraded = (check.degradedStatuses ?? []).includes(response.status);
    const ok = check.okStatuses.includes(response.status);
    let bodyStatus = "";
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null);
      bodyStatus = typeof body?.status === "string" ? body.status : "";
    }
    return {
      id: check.id,
      url: check.url,
      status: response.status,
      degraded,
      ok,
      bodyStatus,
    };
  } catch (error) {
    return {
      id: check.id,
      url: check.url,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseGameSelection(value) {
  const defaultSlugs = ["warline", "scourge-survivors", "deadlane"];
  const requested = !value?.trim()
    ? defaultSlugs
    : value.trim().toLowerCase() === "all"
      ? GAME_APPS.map((game) => game.slug)
      : value
          .split(",")
          .map((slug) => slug.trim())
          .filter(Boolean);

  const known = new Map(GAME_APPS.map((game) => [game.slug, game]));
  const unknown = requested.filter((slug) => !known.has(slug));
  if (unknown.length) throw new Error(`Unknown DEMO_GAME_SLUGS entries: ${unknown.join(", ")}`);
  return [...new Set(requested)].map((slug) => known.get(slug));
}

function parsePort(value, fallback, name) {
  if (!value?.trim()) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be an integer from 1024 to 65535. Received: ${value}`);
  }
  return port;
}
