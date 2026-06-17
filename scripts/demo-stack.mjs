#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { GAME_APPS } from "../packages/catalog/index.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const webPort = parsePort(process.env.DEADROT_DEMO_WEB_PORT, 3000, "DEADROT_DEMO_WEB_PORT");
const apiPort = parsePort(process.env.DEADROT_DEMO_API_PORT, 3004, "DEADROT_DEMO_API_PORT");
const selectedGames = parseGameSelection(process.env.DEMO_GAME_SLUGS);

const processes = [
  {
    id: "web",
    command: "bun",
    args: ["run", "--cwd", "apps/web", "dev", "--hostname", "127.0.0.1", "--port", String(webPort)],
    url: `http://127.0.0.1:${webPort}`,
    env: {
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      FLAG_OVERRIDES: process.env.FLAG_OVERRIDES ?? "{}",
    },
  },
  {
    id: "api",
    command: "bun",
    args: ["run", "--cwd", "apps/api", "dev"],
    url: `http://127.0.0.1:${apiPort}/health/live`,
    env: {
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
      CDN_ORIGIN: process.env.CDN_ORIGIN ?? `http://127.0.0.1:${webPort}/assets`,
      DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE ?? "disable",
      HOST: "127.0.0.1",
      PORT: String(apiPort),
      SERVICE_NAME: "deadrot-api",
    },
  },
  ...selectedGames.map((game) => ({
    id: game.slug,
    command: "bun",
    args: ["run", "--cwd", `apps/games/${game.slug}`, "dev", "--host", "127.0.0.1", "--port", String(game.devPort)],
    url: `http://127.0.0.1:${game.devPort}`,
    env: {
      BROWSER: "none",
      VITE_PARTYKIT_HOST: process.env.VITE_PARTYKIT_HOST ?? "",
      VITE_POSTHOG_KEY: "",
      VITE_SENTRY_DSN: "",
      VITE_WARLINE_HOST: process.env.VITE_WARLINE_HOST ?? "",
    },
  })),
];

console.log("Starting local Deadrot demo stack:");
for (const entry of processes) console.log(`- ${entry.id}: ${entry.url}`);
console.log("");

const children = processes.map(startProcess);
let shuttingDown = false;

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await waitForProcesses(processes);
  console.log("");
  console.log("Deadrot demo stack is reachable.");
  console.log(`Hub: http://127.0.0.1:${webPort}`);
  console.log(`API live: http://127.0.0.1:${apiPort}/health/live`);
  console.log(`API ready/degraded: http://127.0.0.1:${apiPort}/health/ready`);
  console.log("Run `bun run demo:smoke` in another terminal for a URL report.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown("startup failure", 1);
}

function startProcess(entry) {
  const child = spawn(entry.command, entry.args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...entry.env,
      FORCE_COLOR: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    if (!shuttingDown) process.stdout.write(`[${entry.id}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    if (!shuttingDown) process.stderr.write(`[${entry.id}] ${chunk}`);
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[${entry.id}] exited early (${signal ?? code ?? "unknown"})`);
      shutdown(`${entry.id} exited`, 1);
    }
  });

  return child;
}

async function waitForProcesses(entries) {
  await Promise.all(entries.map((entry) => waitForUrl(entry.url, entry.id)));
}

async function waitForUrl(url, label) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 120_000) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}: ${lastError}`);
}

function shutdown(reason, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Stopping demo stack (${reason})...`);
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 750).unref();
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
