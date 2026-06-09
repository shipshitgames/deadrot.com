import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME_APPS } from "@deadrot/catalog";
import { allGames, DEFAULT_PORT_BASE, parsePortBase, parseSelectedGameSlugs } from "./game-catalog";

// Issue #7 — cross-game E2E coverage: unit coverage for the pure catalog/selection
// helpers that drive Playwright project + webServer fan-out.

describe("allGames catalog", () => {
  test("lists the seven shipped games with unique ascending ports", () => {
    expect(allGames.map((g) => g.slug)).toEqual([
      "deadlane",
      "pactfall",
      "redline",
      "rothulk",
      "scourge-survivors",
      "starblight",
      "warline",
    ]);
    const ports = allGames.map((g) => g.port);
    expect(new Set(ports).size).toBe(ports.length); // unique
    expect([...ports].sort((a, b) => a - b)).toEqual(ports); // ascending
    expect(ports[0]).toBe(DEFAULT_PORT_BASE);
  });
});

describe("parseSelectedGameSlugs", () => {
  test("returns [] for undefined / empty / whitespace", () => {
    expect(parseSelectedGameSlugs(undefined)).toEqual([]);
    expect(parseSelectedGameSlugs("")).toEqual([]);
    expect(parseSelectedGameSlugs("   ")).toEqual([]);
  });

  test("parses a single slug", () => {
    expect(parseSelectedGameSlugs("rothulk")).toEqual(["rothulk"]);
  });

  test("parses + trims a comma-separated list and drops empty entries", () => {
    expect(parseSelectedGameSlugs(" deadlane , warline ,, scourge-survivors ")).toEqual([
      "deadlane",
      "warline",
      "scourge-survivors",
    ]);
  });

  test("throws listing every unknown slug", () => {
    expect(() => parseSelectedGameSlugs("deadlane,nope,alsobad")).toThrow(/nope, alsobad/);
  });

  test("accepts every catalog slug", () => {
    const all = allGames.map((g) => g.slug).join(",");
    expect(parseSelectedGameSlugs(all)).toEqual(allGames.map((g) => g.slug));
  });
});

describe("parsePortBase", () => {
  test("defaults to DEFAULT_PORT_BASE when unset/blank", () => {
    expect(parsePortBase(undefined)).toBe(DEFAULT_PORT_BASE);
    expect(parsePortBase("")).toBe(DEFAULT_PORT_BASE);
    expect(parsePortBase("  ")).toBe(DEFAULT_PORT_BASE);
  });

  test("parses a valid integer port", () => {
    expect(parsePortBase("6000")).toBe(6000);
    expect(parsePortBase("1024")).toBe(1024);
    expect(parsePortBase("65529")).toBe(65_529);
  });

  test("rejects non-integers and out-of-range values", () => {
    expect(() => parsePortBase("abc")).toThrow(/E2E_PORT_BASE/);
    expect(() => parsePortBase("1023")).toThrow(/E2E_PORT_BASE/);
    expect(() => parsePortBase("65530")).toThrow(/E2E_PORT_BASE/);
    expect(() => parsePortBase("5174.5")).toThrow(/E2E_PORT_BASE/);
  });
});

describe("catalog ↔ vite.config drift guard", () => {
  test("each game app's vite.config.ts server.port matches its catalog devPort", () => {
    for (const game of GAME_APPS) {
      const configPath = join(import.meta.dir, "..", "apps", "games", game.slug, "vite.config.ts");
      const config = readFileSync(configPath, "utf8");
      const match = config.match(/port:\s*(\d+)/);
      expect(match?.[1]).toBe(String(game.devPort));
    }
  });
});

describe("catalog runtime facts", () => {
  test("every app has a unique https deploy URL", () => {
    const urls = GAME_APPS.map((game) => game.deployUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
