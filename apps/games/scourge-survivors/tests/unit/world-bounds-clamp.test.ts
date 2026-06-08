import { type MapBounds, makeBounds, RectBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

// Issue #86 — WorldBounds clamp / contains / random-spawn behaviour.
// Note: the engine's spawn method is named `randomPointXZ` (the gap brief called
// it "randomSpawnPoint"); we test the real exported public API.

describe("WorldBounds geometry", () => {
  it("RectBounds.square produces a centered square of the requested half-extent", () => {
    const bounds = RectBounds.square(10);

    expect(bounds.minX).toBe(-10);
    expect(bounds.maxX).toBe(10);
    expect(bounds.minZ).toBe(-10);
    expect(bounds.maxZ).toBe(10);
    // Symmetric extents.
    expect(bounds.maxX - bounds.minX).toBe(20);
    expect(bounds.maxZ - bounds.minZ).toBe(20);
  });

  it("makeBounds resolves a square spec to the same geometry as RectBounds.square", () => {
    const spec: MapBounds = { kind: "square", half: 16 };
    const bounds = makeBounds(spec);

    expect(bounds).toBeInstanceOf(RectBounds);
    expect(bounds.minX).toBe(-16);
    expect(bounds.maxX).toBe(16);
    expect(bounds.minZ).toBe(-16);
    expect(bounds.maxZ).toBe(16);
  });

  it("makeBounds resolves an asymmetric rect spec preserving each edge independently", () => {
    const spec: MapBounds = { kind: "rect", minX: -12, maxX: 18, minZ: -8, maxZ: 24 };
    const bounds = makeBounds(spec);

    expect(bounds.minX).toBe(-12);
    expect(bounds.maxX).toBe(18);
    expect(bounds.minZ).toBe(-8);
    expect(bounds.maxZ).toBe(24);
    // Asymmetric: span and center differ from a square.
    expect(bounds.maxX - bounds.minX).toBe(30);
    expect(bounds.maxZ - bounds.minZ).toBe(32);
    expect((bounds.minX + bounds.maxX) / 2).toBe(3);
    expect((bounds.minZ + bounds.maxZ) / 2).toBe(8);
  });
});

describe("WorldBounds.containsXZ", () => {
  const bounds = new RectBounds(-12, 18, -8, 24);

  it("reports interior points as inside", () => {
    expect(bounds.containsXZ(0, 0)).toBe(true);
    expect(bounds.containsXZ(17, 23)).toBe(true);
    expect(bounds.containsXZ(-11, -7)).toBe(true);
  });

  it("treats exact edges as inside (inclusive) with no margin", () => {
    expect(bounds.containsXZ(bounds.minX, 0)).toBe(true);
    expect(bounds.containsXZ(bounds.maxX, 0)).toBe(true);
    expect(bounds.containsXZ(0, bounds.minZ)).toBe(true);
    expect(bounds.containsXZ(0, bounds.maxZ)).toBe(true);
  });

  it("reports points just beyond any edge as outside", () => {
    expect(bounds.containsXZ(bounds.minX - 0.01, 0)).toBe(false);
    expect(bounds.containsXZ(bounds.maxX + 0.01, 0)).toBe(false);
    expect(bounds.containsXZ(0, bounds.minZ - 0.01)).toBe(false);
    expect(bounds.containsXZ(0, bounds.maxZ + 0.01)).toBe(false);
  });

  it("insets every edge by the margin", () => {
    // (17, 23) is inside the raw box but the margin of 2 pulls maxX to 16, maxZ to 22.
    expect(bounds.containsXZ(17, 23)).toBe(true);
    expect(bounds.containsXZ(17, 23, 2)).toBe(false);
    // A point safely within the inset box stays inside.
    expect(bounds.containsXZ(15, 21, 2)).toBe(true);
    // The inset boundary itself is inclusive.
    expect(bounds.containsXZ(bounds.minX + 2, bounds.minZ + 2, 2)).toBe(true);
    expect(bounds.containsXZ(bounds.minX + 1.99, 0, 2)).toBe(false);
  });
});

describe("WorldBounds.clampXZ", () => {
  it("leaves interior points untouched", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const pos = new THREE.Vector3(5, 1.5, 10);
    bounds.clampXZ(pos);

    expect(pos.x).toBe(5);
    expect(pos.z).toBe(10);
    expect(pos.y).toBe(1.5); // y is never touched.
  });

  it("clamps points beyond each edge back onto the corresponding edge", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);

    const overMax = new THREE.Vector3(100, 2, 100);
    bounds.clampXZ(overMax);
    expect(overMax.x).toBe(18);
    expect(overMax.z).toBe(24);
    expect(overMax.y).toBe(2);

    const underMin = new THREE.Vector3(-100, 3, -100);
    bounds.clampXZ(underMin);
    expect(underMin.x).toBe(-12);
    expect(underMin.z).toBe(-8);
    expect(underMin.y).toBe(3);
  });

  it("clamps independently per axis (asymmetric box)", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const pos = new THREE.Vector3(50, 0, -50);
    bounds.clampXZ(pos);

    expect(pos.x).toBe(18); // hit maxX
    expect(pos.z).toBe(-8); // hit minZ
  });

  it("applies a margin so clamped points stay inset from the wall", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const pos = new THREE.Vector3(100, 0, -100);
    bounds.clampXZ(pos, 3);

    expect(pos.x).toBe(15); // maxX - margin
    expect(pos.z).toBe(-5); // minZ + margin
    // Clamped result must be contained within the same inset.
    expect(bounds.containsXZ(pos.x, pos.z, 3)).toBe(true);
  });

  it("clamps a point onto the boundary that contains it at zero margin", () => {
    const bounds = RectBounds.square(8);
    const pos = new THREE.Vector3(20, 0, 20);
    bounds.clampXZ(pos);

    expect(bounds.containsXZ(pos.x, pos.z)).toBe(true);
    expect(pos.x).toBe(8);
    expect(pos.z).toBe(8);
  });
});

describe("WorldBounds.randomPointXZ", () => {
  it("writes a point inside the bounds and returns the same out vector, leaving y untouched", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const out = new THREE.Vector3(999, 7.25, 999);
    const result = bounds.randomPointXZ(0, out);

    expect(result).toBe(out); // returns the passed-in vector
    expect(out.y).toBe(7.25); // y untouched
    expect(bounds.containsXZ(out.x, out.z)).toBe(true);
  });

  it("keeps many sampled spawn points within the asymmetric bounds", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const out = new THREE.Vector3();

    for (let i = 0; i < 2000; i++) {
      bounds.randomPointXZ(0, out);
      expect(out.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(out.x).toBeLessThanOrEqual(bounds.maxX);
      expect(out.z).toBeGreaterThanOrEqual(bounds.minZ);
      expect(out.z).toBeLessThanOrEqual(bounds.maxZ);
    }
  });

  it("respects the spawn margin across many samples", () => {
    const bounds = new RectBounds(-12, 18, -8, 24);
    const out = new THREE.Vector3();
    const margin = 2.5;

    for (let i = 0; i < 2000; i++) {
      bounds.randomPointXZ(margin, out);
      expect(bounds.containsXZ(out.x, out.z, margin)).toBe(true);
    }
  });

  it("collapses to a single point when the margin exceeds half the span", () => {
    // span is 20 on each axis; a margin of 15 fully consumes it, so the span is clamped to 0.
    const bounds = RectBounds.square(10);
    const out = new THREE.Vector3();
    bounds.randomPointXZ(15, out);

    // out = min + margin + random * 0 => min + margin, deterministically.
    expect(out.x).toBe(bounds.minX + 15);
    expect(out.z).toBe(bounds.minZ + 15);
  });

  it("covers a representative spread of the available area over many samples", () => {
    const bounds = RectBounds.square(50);
    const out = new THREE.Vector3();
    let minSeen = Number.POSITIVE_INFINITY;
    let maxSeen = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < 5000; i++) {
      bounds.randomPointXZ(0, out);
      minSeen = Math.min(minSeen, out.x);
      maxSeen = Math.max(maxSeen, out.x);
    }

    // With 5000 uniform samples over [-50, 50] we expect to reach near both extremes.
    expect(minSeen).toBeLessThan(-40);
    expect(maxSeen).toBeGreaterThan(40);
  });
});
