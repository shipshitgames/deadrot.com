// Contract tests for the biome preset catalog (issue #80): catalog shape,
// per-preset theme sanity, the canon colour gates (toxic-green reserved for
// rot, no cool blue/teal grades, only cryo coined), literal pins for the four
// map-seeded palettes (the visual-parity contract with the shipped scourge
// maps), and the resolveBiomeTheme purity/merge/error rules.

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BiomeId, BiomeThemeOverrides } from "../src/maps/biomes";
import { BIOME_IDS, BIOMES, DEFAULT_BIOME_ID, isBiomeId, resolveBiomeTheme } from "../src/maps/biomes";

function channels(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

/** The canon "toxic-green" signature: green clearly dominates both other channels. */
function isGreenDominant(color: number): boolean {
  const { r, g, b } = channels(color);
  return g > 1.2 * r && g > 1.2 * b;
}

/** The banned cool-grade signature: blue clearly dominates both other channels. */
function isBlueDominant(color: number): boolean {
  const { r, g, b } = channels(color);
  return b > 1.25 * r && b > 1.25 * g;
}

function isColor(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

// --- catalog shape ------------------------------------------------------------

test("BIOME_IDS is pinned literally (persisted-data contract)", () => {
  assert.deepEqual([...BIOME_IDS], ["foundry", "bone", "rot", "perdition", "cinderwell", "cryo"]);
});

test("BIOMES keys match BIOME_IDS and every preset.id equals its key", () => {
  assert.deepEqual(Object.keys(BIOMES), [...BIOME_IDS]);
  for (const [key, preset] of Object.entries(BIOMES)) {
    assert.equal(preset.id, key, `preset under key "${key}" carries its own id`);
  }
});

test('DEFAULT_BIOME_ID is "foundry" and is a catalog member', () => {
  assert.equal(DEFAULT_BIOME_ID, "foundry");
  assert.ok(BIOME_IDS.includes(DEFAULT_BIOME_ID));
});

// --- per-preset theme contract --------------------------------------------------

test("every preset has a sane theme: integer 24-bit colours, fogNear < fogFar, finite accents, non-empty metadata", () => {
  for (const id of BIOME_IDS) {
    const preset = BIOMES[id];
    const { theme } = preset;

    for (const [field, value] of [
      ["bg", theme.bg],
      ["floorTint", theme.floorTint],
      ["wallTint", theme.wallTint],
      ["trim", theme.trim],
      ["accentA.color", theme.accentA.color],
      ["accentB.color", theme.accentB.color],
    ] as const) {
      assert.ok(isColor(value), `${id}.${field} is an integer in [0, 0xffffff] (got ${value})`);
    }

    assert.ok(Number.isFinite(theme.fogNear), `${id} fogNear finite`);
    assert.ok(Number.isFinite(theme.fogFar), `${id} fogFar finite`);
    assert.ok(theme.fogNear < theme.fogFar, `${id} fogNear < fogFar`);

    for (const accent of [theme.accentA, theme.accentB]) {
      assert.ok(Number.isFinite(accent.x), `${id} accent x finite`);
      assert.ok(Number.isFinite(accent.y), `${id} accent y finite`);
      assert.ok(Number.isFinite(accent.z), `${id} accent z finite`);
    }

    assert.ok(preset.materialHints.length > 0, `${id} has material hints`);
    for (const hint of preset.materialHints) {
      assert.ok(hint.length > 0, `${id} material hint non-empty`);
    }
    assert.ok(preset.name.length > 0, `${id} has a name`);
    assert.ok(preset.description.length > 0, `${id} has a description`);
  }
});

// --- canon gates ----------------------------------------------------------------

test("toxic-green trim/accents are reserved for rot — green dominance passes ONLY there", () => {
  for (const id of BIOME_IDS) {
    const { theme } = BIOMES[id];
    const greens = [theme.trim, theme.accentA.color, theme.accentB.color].some(isGreenDominant);
    assert.equal(greens, id === "rot", `${id}: green-dominant trim/accents iff rot`);
  }
});

test("no cool grades: no preset's tints/trim/accents are blue-dominant", () => {
  for (const id of BIOME_IDS) {
    const { theme } = BIOMES[id];
    for (const [field, color] of [
      ["floorTint", theme.floorTint],
      ["wallTint", theme.wallTint],
      ["trim", theme.trim],
      ["accentA.color", theme.accentA.color],
      ["accentB.color", theme.accentB.color],
    ] as const) {
      assert.equal(isBlueDominant(color), false, `${id}.${field} must not be blue-dominant`);
    }
  }
});

test("only cryo is a coined (provisional) name", () => {
  for (const id of BIOME_IDS) {
    assert.equal(BIOMES[id].coined === true, id === "cryo", `${id}: coined iff cryo`);
  }
});

// --- exact pins: the four map-seeded presets (visual-parity contract) ------------

test("foundry theme is pinned to the shipped ASHGATE values", () => {
  assert.deepEqual(BIOMES.foundry.theme, {
    bg: 0x160d08,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0xc9a98a,
    wallTint: 0xb89274,
    trim: 0xff6a00,
    accentA: { color: 0xff6a00, x: -26, y: 8, z: -26 },
    accentB: { color: 0xff8a3c, x: 26, y: 9, z: 26 },
  });
});

test("bone theme is pinned to the shipped HOLLOWLANES values", () => {
  assert.deepEqual(BIOMES.bone.theme, {
    bg: 0x181818,
    fogNear: 30,
    fogFar: 150,
    floorTint: 0xd4c8b7,
    wallTint: 0xc4b8a6,
    trim: 0xcdbfae,
    accentA: { color: 0xcdbfae, x: -26, y: 9, z: -26 },
    accentB: { color: 0x9b958a, x: 26, y: 9, z: 26 },
  });
});

test("rot theme is pinned to the shipped MAW values", () => {
  assert.deepEqual(BIOMES.rot.theme, {
    bg: 0x0a0f08,
    fogNear: 38,
    fogFar: 175,
    floorTint: 0x6b7a5a,
    wallTint: 0x5a6b4a,
    trim: 0x6acf3c,
    accentA: { color: 0x8bdc1f, x: -26, y: 9, z: -26 },
    accentB: { color: 0x6acf3c, x: 26, y: 9, z: 26 },
  });
});

test("perdition theme is pinned to the shipped PERDITION values", () => {
  assert.deepEqual(BIOMES.perdition.theme, {
    bg: 0x1a0408,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0x9a5560,
    wallTint: 0x86424e,
    trim: 0xc1121f,
    accentA: { color: 0xc1121f, x: -26, y: 9, z: -26 },
    accentB: { color: 0xff2a18, x: 26, y: 8, z: 26 },
  });
});

// --- resolveBiomeTheme ------------------------------------------------------------

test("no overrides: result deep-equals the preset theme but theme + both accents are FRESH objects", () => {
  for (const id of BIOME_IDS) {
    const preset = BIOMES[id].theme;
    const resolved = resolveBiomeTheme(id);
    assert.deepEqual(resolved, preset, `${id} resolves to its preset values`);
    assert.notEqual(resolved, preset, `${id} theme is a fresh object`);
    assert.notEqual(resolved.accentA, preset.accentA, `${id} accentA is fresh`);
    assert.notEqual(resolved.accentB, preset.accentB, `${id} accentB is fresh`);
  }
});

test("scalar overrides replace preset values; untouched fields keep them", () => {
  const resolved = resolveBiomeTheme("foundry", { bg: 0x000000, fogFar: 220, trim: 0xaa5500 });
  assert.equal(resolved.bg, 0x000000);
  assert.equal(resolved.fogFar, 220);
  assert.equal(resolved.trim, 0xaa5500);
  assert.equal(resolved.fogNear, BIOMES.foundry.theme.fogNear);
  assert.equal(resolved.floorTint, BIOMES.foundry.theme.floorTint);
  assert.equal(resolved.wallTint, BIOMES.foundry.theme.wallTint);
  assert.deepEqual(resolved.accentA, BIOMES.foundry.theme.accentA);
  assert.deepEqual(resolved.accentB, BIOMES.foundry.theme.accentB);
});

test("the rot flesh-forward variant documented on the preset works as plain overrides", () => {
  const resolved = resolveBiomeTheme("rot", { floorTint: 0x7a4a44, wallTint: 0x63403c });
  assert.equal(resolved.floorTint, 0x7a4a44);
  assert.equal(resolved.wallTint, 0x63403c);
  assert.equal(resolved.trim, BIOMES.rot.theme.trim, "toxic-green trim untouched");
});

test("partial accent overrides merge per-field (color/x/z survive a y-only override)", () => {
  const base = BIOMES.foundry.theme;
  const resolved = resolveBiomeTheme("foundry", { accentA: { y: 12 } });
  assert.deepEqual(resolved.accentA, { color: base.accentA.color, x: base.accentA.x, y: 12, z: base.accentA.z });
  assert.deepEqual(resolved.accentB, base.accentB, "the other accent is untouched");

  const both = resolveBiomeTheme("bone", { accentA: { color: 0x111111 }, accentB: { x: 5, z: -5 } });
  assert.deepEqual(both.accentA, { ...BIOMES.bone.theme.accentA, color: 0x111111 });
  assert.deepEqual(both.accentB, { ...BIOMES.bone.theme.accentB, x: 5, z: -5 });
});

test("unknown biome ids throw a TypeError with the function-prefixed message", () => {
  assert.throws(() => resolveBiomeTheme("ashgate"), TypeError);
  assert.throws(() => resolveBiomeTheme("reactor"), /resolveBiomeTheme: unknown biome id/);
  assert.throws(() => resolveBiomeTheme(""), /resolveBiomeTheme: unknown biome id ""/);
});

test("deep-frozen overrides are safe and the overrides object is never mutated", () => {
  const overrides: BiomeThemeOverrides = { fogNear: 20, accentA: { y: 4 }, accentB: { color: 0x222222 } };
  const clone = structuredClone(overrides);
  deepFreeze(overrides);

  const resolved = resolveBiomeTheme("cinderwell", overrides);
  assert.equal(resolved.fogNear, 20);
  assert.equal(resolved.accentA.y, 4);
  assert.equal(resolved.accentB.color, 0x222222);
  assert.deepEqual(overrides, clone, "overrides untouched");
  assert.notEqual(resolved.accentA, overrides.accentA, "result never aliases the overrides");
  assert.notEqual(resolved.accentB, overrides.accentB, "result never aliases the overrides");
});

test("deterministic: calling twice with the same args gives deep-equal (but fresh) results", () => {
  const overrides: BiomeThemeOverrides = { floorTint: 0x123456, accentA: { x: 1 } };
  const first = resolveBiomeTheme("cryo", overrides);
  const second = resolveBiomeTheme("cryo", overrides);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.accentA, second.accentA);
  assert.deepEqual(resolveBiomeTheme("perdition"), resolveBiomeTheme("perdition"));
});

test("isBiomeId narrows exactly the catalog ids", () => {
  for (const id of BIOME_IDS) {
    assert.equal(isBiomeId(id), true, `${id} is a biome id`);
  }
  assert.equal(isBiomeId(""), false);
  assert.equal(isBiomeId("ashgate"), false);
  assert.equal(isBiomeId("reactor"), false);
});

test("the catalog is deep-frozen reference data", () => {
  assert.ok(Object.isFrozen(BIOMES));
  for (const id of BIOME_IDS) {
    assert.ok(Object.isFrozen(BIOMES[id]), `${id} preset frozen`);
    assert.ok(Object.isFrozen(BIOMES[id].theme), `${id} theme frozen`);
    assert.ok(Object.isFrozen(BIOMES[id].theme.accentA), `${id} accentA frozen`);
    assert.ok(Object.isFrozen(BIOMES[id].theme.accentB), `${id} accentB frozen`);
    assert.ok(Object.isFrozen(BIOMES[id].materialHints), `${id} materialHints frozen`);
  }
});

// Type-level check (compile time): a BiomeId indexes the catalog without a cast.
const _typecheck: BiomeId = DEFAULT_BIOME_ID;
void _typecheck;
