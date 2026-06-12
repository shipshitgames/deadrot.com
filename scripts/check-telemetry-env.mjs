#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apps = [
  { name: "deadlane", dir: "apps/games/deadlane", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "pactfall", dir: "apps/games/pactfall", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "redline", dir: "apps/games/redline", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "rothulk", dir: "apps/games/rothulk", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  {
    name: "scourge-survivors",
    dir: "apps/games/scourge-survivors",
    dsnKey: "VITE_SENTRY_DSN",
    releaseKey: "VITE_DEADROT_RELEASE",
  },
  { name: "starblight", dir: "apps/games/starblight", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "warline", dir: "apps/games/warline", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "lore", dir: "apps/lore", dsnKey: "VITE_SENTRY_DSN", releaseKey: "VITE_DEADROT_RELEASE" },
  { name: "web", dir: "apps/web", dsnKey: "NEXT_PUBLIC_SENTRY_DSN", releaseKey: "NEXT_PUBLIC_DEADROT_RELEASE" },
];

const rootEnv = {
  ...parseEnvFile(path.join(root, ".env.production")),
  ...parseEnvFile(path.join(root, ".env.local")),
  ...process.env,
};

let failures = 0;
let warnings = 0;

console.log("Telemetry env check\n");

for (const app of apps) {
  const appEnv = {
    ...rootEnv,
    ...parseEnvFile(path.join(root, app.dir, ".env.production")),
    ...parseEnvFile(path.join(root, app.dir, ".env.local")),
  };
  const dsn = appEnv[app.dsnKey];
  const sentryProject = appEnv.SENTRY_PROJECT;
  const release = appEnv[app.releaseKey] || appEnv.SENTRY_RELEASE;
  const posthog = appEnv.VITE_POSTHOG_KEY;

  const problems = [];
  const notes = [];
  if (!dsn) problems.push(`${app.dsnKey} missing`);
  if (!sentryProject) problems.push("SENTRY_PROJECT missing");
  if (!release) notes.push(`${app.releaseKey} or SENTRY_RELEASE missing`);
  if (app.name !== "web" && app.name !== "lore" && !posthog) notes.push("VITE_POSTHOG_KEY missing");

  if (problems.length > 0) {
    failures += 1;
    console.log(`FAIL ${app.name}: ${problems.join(", ")}`);
  } else if (notes.length > 0) {
    warnings += 1;
    console.log(`WARN ${app.name}: ${notes.join(", ")}`);
  } else {
    console.log(`OK   ${app.name}`);
  }
}

console.log("");
if (!rootEnv.SENTRY_AUTH_TOKEN) {
  warnings += 1;
  console.log("WARN SENTRY_AUTH_TOKEN missing; source-map upload will not work.");
}

if (failures > 0) {
  console.log(`\n${failures} app(s) are missing required telemetry env.`);
  process.exit(1);
}

if (warnings > 0) {
  console.log(`\nTelemetry env is usable, with ${warnings} warning(s).`);
} else {
  console.log("\nTelemetry env looks ready.");
}

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 0) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}
