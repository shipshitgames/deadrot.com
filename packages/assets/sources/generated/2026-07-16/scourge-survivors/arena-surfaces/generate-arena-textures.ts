import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Preserved source recipe for the 2026-07-16 Scourge Survivors arena surface pass.
export const ARENA_TEXTURE_SIZE = 512;
const SIZE = ARENA_TEXTURE_SIZE;

type RGB = readonly [number, number, number];
export type ArenaTextureMapId = "ashgate" | "hollowlanes" | "maw" | "perdition";
export type ArenaTextureRole = "floor" | "wall" | "block" | "column";

interface Palette {
  base: RGB;
  low: RGB;
  high: RGB;
  ink: RGB;
  accent: RGB;
  accentHot: RGB;
  bone: RGB;
  seed: number;
}

const PALETTES: Record<ArenaTextureMapId, Palette> = {
  ashgate: {
    base: [48, 40, 37],
    low: [22, 18, 18],
    high: [102, 67, 45],
    ink: [9, 7, 8],
    accent: [193, 57, 20],
    accentHot: [255, 106, 0],
    bone: [194, 172, 142],
    seed: 11,
  },
  hollowlanes: {
    base: [50, 49, 48],
    low: [19, 19, 21],
    high: [119, 112, 101],
    ink: [8, 8, 10],
    accent: [171, 159, 142],
    accentHot: [224, 216, 202],
    bone: [233, 227, 214],
    seed: 23,
  },
  maw: {
    base: [27, 35, 29],
    low: [7, 12, 9],
    high: [63, 76, 56],
    ink: [4, 7, 5],
    accent: [67, 111, 57],
    accentHot: [139, 220, 31],
    bone: [180, 177, 133],
    seed: 37,
  },
  perdition: {
    base: [52, 20, 27],
    low: [15, 5, 10],
    high: [109, 43, 48],
    ink: [7, 2, 5],
    accent: [193, 18, 31],
    accentHot: [255, 42, 24],
    bone: [180, 142, 132],
    seed: 53,
  },
};

function clamp(value: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, value));
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function shade(color: RGB, amount: number): RGB {
  return [clamp(color[0] + amount), clamp(color[1] + amount), clamp(color[2] + amount)];
}

function hash(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function periodicNoise(x: number, y: number, scale: number, seed: number): number {
  const cells = SIZE / scale;
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const at = (ix: number, iy: number) => hash((ix + cells) % cells, (iy + cells) % cells, seed);
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function wrapDistance(value: number, center: number, period = SIZE): number {
  const direct = Math.abs(value - center);
  return Math.min(direct, period - direct);
}

function distanceToPeriodic(value: number, period: number, offset = 0): number {
  const local = ((value - offset) % period + period) % period;
  return Math.min(local, period - local);
}

function lineMask(distance: number, core: number, feather: number): number {
  if (distance <= core) return 1;
  if (distance >= core + feather) return 0;
  return 1 - (distance - core) / feather;
}

function nearestPeriodicStop(value: number, stops: readonly number[]): number {
  return Math.min(...stops.map((stop) => wrapDistance(value, stop)));
}

function composite(base: RGB, overlay: RGB, alpha: number): RGB {
  return mix(base, overlay, clamp(alpha, 0, 1));
}

function materialBase(p: Palette, x: number, y: number, seedOffset: number): RGB {
  const broad = periodicNoise(x, y, 128, p.seed + seedOffset);
  const medium = periodicNoise(x, y, 64, p.seed + seedOffset + 101);
  const light = broad * 0.62 + medium * 0.38;
  const celBand = Math.floor(clamp(light, 0, 0.999) * 5) / 4;
  let color = mix(p.low, p.high, 0.13 + celBand * 0.58);
  const micro = periodicNoise(x, y, 32, p.seed + seedOffset + 211);
  if (micro < 0.28) color = shade(color, -12);
  if (micro > 0.76) color = shade(color, 10);
  return color;
}

function grime(color: RGB, p: Palette, x: number, y: number, seedOffset: number): RGB {
  const broad = periodicNoise(x, y, 128, p.seed + seedOffset);
  const sweep = 0.5 + 0.5 * Math.sin((x * 2 + y) * (Math.PI / 128));
  let output = color;
  if (broad < 0.36) output = composite(output, p.ink, 0.2);
  if (sweep > 0.92) output = composite(output, p.ink, 0.16);

  const fleck = hash(x, y, p.seed + seedOffset + 401);
  if (fleck > 0.985) output = composite(output, p.ink, 0.72);
  else if (fleck < 0.012) output = composite(output, p.high, 0.55);

  const crack =
    distanceToPeriodic(
      y - 26 * Math.sin((x * Math.PI) / 128) - 8 * Math.sin((x * Math.PI) / 32),
      512,
      (p.seed * 19 + seedOffset * 7) % 512,
    );
  const crackGate = periodicNoise(x, y, 64, p.seed + seedOffset + 503);
  output = composite(output, p.ink, lineMask(crack, 0.7, 1.4) * (crackGate > 0.43 ? 0.72 : 0));

  const hatch = distanceToPeriodic(x + y, 64, (p.seed * 7 + seedOffset) % 64);
  const hatchGate = hash(Math.floor(x / 32) * 32, Math.floor(y / 32) * 32, p.seed + seedOffset + 607);
  output = composite(output, p.high, lineMask(hatch, 0.55, 0.8) * (hatchGate > 0.78 ? 0.26 : 0));
  return output;
}

function drawFloor(mapId: ArenaTextureMapId, x: number, y: number): RGB {
  const p = PALETTES[mapId];
  let color = grime(materialBase(p, x, y, 0), p, x, y, 7);

  if (mapId === "ashgate") {
    const xSeam = nearestPeriodicStop(x, [0, 116, 278, 408]);
    const ySeam = nearestPeriodicStop(y, [0, 138, 296, 418]);
    const seam = Math.min(xSeam, ySeam);
    color = composite(color, p.ink, lineMask(seam, 3.5, 2.5) * 0.98);
    color = composite(color, p.high, lineMask(Math.min(Math.abs(xSeam - 10), Math.abs(ySeam - 10)), 1, 2) * 0.26);
    const rivet = Math.hypot(xSeam, ySeam);
    color = composite(color, p.bone, lineMask(rivet, 3.2, 1.4) * 0.58);
    const offset = y < 138 || (y >= 296 && y < 418) ? 34 : 92;
    const diagonal = distanceToPeriodic(x - y * 0.5, 256, offset);
    const diagonalGate = periodicNoise(x, y, 64, p.seed + 711);
    color = composite(color, p.ink, lineMask(diagonal, 2.5, 2.5) * (diagonalGate > 0.48 ? 0.82 : 0));
    const heat = distanceToPeriodic(x + y * 0.5, 256, 20 + 18 * Math.sin((y * Math.PI) / 256));
    const heatGate = periodicNoise(x, y, 64, p.seed + 727);
    color = composite(color, p.accentHot, lineMask(heat, 1.2, 2.2) * (heatGate > 0.46 ? 0.42 : 0));
  } else if (mapId === "hollowlanes") {
    const roadJoint = nearestPeriodicStop(y, [18, 112, 248, 386]);
    color = composite(color, p.ink, lineMask(roadJoint, 5, 3) * 0.96);
    const laneGroove = nearestPeriodicStop(x, [0, 154, 342]);
    color = composite(color, p.ink, lineMask(laneGroove, 3, 4) * 0.8);
    const wornMark = distanceToPeriodic(x, 256, 128);
    const broken = periodicNoise(x, y, 64, p.seed + 44);
    color = composite(color, p.bone, lineMask(wornMark, 6, 5) * Math.max(0, broken - 0.42) * 0.32);
  } else if (mapId === "maw") {
    const ribA = Math.abs(Math.sin((x * Math.PI) / 128 + Math.sin((y * Math.PI) / 256) * 0.8));
    const ribB = Math.abs(Math.sin((y * Math.PI) / 128 - Math.sin((x * Math.PI) / 256) * 0.65));
    const chitin = Math.min(ribA, ribB);
    color = composite(color, p.ink, lineMask(chitin * 34, 2.5, 3.5) * 0.92);
    color = composite(color, p.bone, lineMask(chitin * 34, 6, 2) * 0.18);
    const organ = distanceToPeriodic(x + Math.sin((y * Math.PI) / 128) * 18, 256, 72);
    const organGate = periodicNoise(x, y, 64, p.seed + 743);
    color = composite(color, p.accentHot, lineMask(organ, 1, 2.5) * (organGate > 0.48 ? 0.45 : 0));
  } else {
    const membrane = Math.abs(Math.sin((x * Math.PI) / 128 + Math.sin((y * Math.PI) / 128)));
    color = composite(color, p.ink, lineMask(membrane * 30, 3, 3) * 0.92);
    const rib = distanceToPeriodic(y + Math.sin((x * Math.PI) / 128) * 20, 128);
    color = composite(color, p.bone, lineMask(rib, 3, 3) * 0.2);
    const pulse = distanceToPeriodic(x - y * 0.5, 256, 52);
    const pulseGate = periodicNoise(x, y, 64, p.seed + 761);
    color = composite(color, p.accentHot, lineMask(pulse, 1.2, 2.8) * (pulseGate > 0.48 ? 0.48 : 0));
  }

  return color;
}

function drawWall(mapId: ArenaTextureMapId, x: number, y: number): RGB {
  const p = PALETTES[mapId];
  let color = grime(materialBase(p, x, y, 300), p, x, y, 317);
  const band = nearestPeriodicStop(y, [0, 104, 238, 374]);
  color = composite(color, p.ink, lineMask(band, 7, 4) * 0.98);
  color = composite(color, p.high, lineMask(Math.abs(band - 13), 2, 4) * 0.25);

  if (mapId === "ashgate") {
    const upright = nearestPeriodicStop(x, [18, 146, 322, 452]);
    color = composite(color, p.ink, lineMask(upright, 7, 4) * 0.92);
    const stripe = ((x + y * 0.5) % 64 + 64) % 64;
    const hazard = stripe < 22 && y > 330 && y < 430;
    if (hazard) color = composite(color, p.accentHot, 0.42);
    const rivet = Math.hypot(distanceToPeriodic(x, 128, 52), distanceToPeriodic(y, 128, 38));
    color = composite(color, p.bone, lineMask(rivet, 5, 2) * 0.48);
  } else if (mapId === "hollowlanes") {
    const buttress = nearestPeriodicStop(x, [30, 184, 372]);
    color = composite(color, p.ink, lineMask(buttress, 8, 5) * 0.93);
    const chalk = distanceToPeriodic(x - y * 0.5, 256, 120);
    color = composite(color, p.bone, lineMask(chalk, 4, 5) * 0.2);
  } else if (mapId === "maw") {
    const plate = Math.abs(Math.sin((x * Math.PI) / 128 + Math.sin((y * Math.PI) / 256) * 0.75));
    color = composite(color, p.ink, lineMask(plate * 30, 3, 3) * 0.95);
    const organ = distanceToPeriodic(y + Math.sin((x * Math.PI) / 64) * 14, 256, 70);
    color = composite(color, p.accentHot, lineMask(organ, 1.3, 2.5) * 0.5);
  } else {
    const rib = distanceToPeriodic(x + Math.sin((y * Math.PI) / 128) * 16, 128);
    color = composite(color, p.ink, lineMask(rib, 5, 4) * 0.92);
    color = composite(color, p.accent, lineMask(rib, 10, 4) * 0.24);
    const wound = distanceToPeriodic(y - x * 0.5, 256, 45);
    color = composite(color, p.accentHot, lineMask(wound, 1, 3) * 0.48);
  }

  return color;
}

function drawBlock(mapId: ArenaTextureMapId, x: number, y: number): RGB {
  const p = PALETTES[mapId];
  let color = grime(materialBase(p, x, y, 600), p, x, y, 617);
  const edge = Math.min(wrapDistance(x, 0), wrapDistance(y, 0));
  color = composite(color, p.ink, lineMask(edge, 10, 7) * 0.98);
  const inset = Math.min(
    Math.abs(x - 72),
    Math.abs(x - (SIZE - 72)),
    Math.abs(y - 72),
    Math.abs(y - (SIZE - 72)),
  );
  color = composite(color, p.ink, lineMask(inset, 6, 5) * 0.9);
  color = composite(color, p.high, lineMask(inset, 14, 5) * 0.2);
  const cornerBolt = Math.min(
    Math.hypot(wrapDistance(x, 54), wrapDistance(y, 54)),
    Math.hypot(wrapDistance(x, SIZE - 54), wrapDistance(y, 54)),
    Math.hypot(wrapDistance(x, 54), wrapDistance(y, SIZE - 54)),
    Math.hypot(wrapDistance(x, SIZE - 54), wrapDistance(y, SIZE - 54)),
  );
  color = composite(color, p.bone, lineMask(cornerBolt, 5, 2) * 0.48);

  if (mapId === "ashgate") {
    const slash = distanceToPeriodic(x + y, 256, 64);
    color = composite(color, p.accentHot, lineMask(slash, 3, 4) * 0.3);
  } else if (mapId === "hollowlanes") {
    const mark = distanceToPeriodic(x, 256, 128);
    color = composite(color, p.bone, lineMask(mark, 8, 7) * 0.24);
  } else if (mapId === "maw") {
    const core = Math.hypot(x - 256, y - 256);
    color = composite(color, p.ink, lineMask(Math.abs(core - 112), 6, 5) * 0.82);
    color = composite(color, p.accentHot, lineMask(Math.abs(core - 72), 2, 4) * 0.36);
  } else {
    const wound = Math.abs(Math.sin((x + y) * (Math.PI / 128)));
    color = composite(color, p.accentHot, lineMask(wound * 32, 1.2, 3) * 0.42);
  }

  return color;
}

function drawColumn(mapId: ArenaTextureMapId, x: number, y: number): RGB {
  const p = PALETTES[mapId];
  let color = grime(materialBase(p, x, y, 900), p, x, y, 917);
  const rib = distanceToPeriodic(x, 128);
  color = composite(color, p.ink, lineMask(rib, 6, 4) * 0.96);
  color = composite(color, p.high, lineMask(distanceToPeriodic(x, 128, 13), 3, 5) * 0.25);
  const collar = distanceToPeriodic(y, 128);
  color = composite(color, p.ink, lineMask(collar, 9, 5) * 0.98);

  if (mapId === "ashgate") {
    color = composite(color, p.accentHot, lineMask(distanceToPeriodic(x, 256, 48), 3, 3) * 0.34);
  } else if (mapId === "hollowlanes") {
    color = composite(color, p.bone, lineMask(distanceToPeriodic(y, 256, 64), 5, 5) * 0.2);
  } else if (mapId === "maw") {
    const tendon = distanceToPeriodic(x + Math.sin((y * Math.PI) / 128) * 13, 128, 40);
    color = composite(color, p.accentHot, lineMask(tendon, 1.2, 2.8) * 0.44);
  } else {
    const artery = distanceToPeriodic(y - Math.sin((x * Math.PI) / 64) * 16, 256, 62);
    color = composite(color, p.accentHot, lineMask(artery, 1.4, 3) * 0.46);
  }

  return color;
}

export function renderArenaTexture(mapId: ArenaTextureMapId, role: ArenaTextureRole): Uint8Array {
  const pixels = new Uint8Array(SIZE * SIZE * 3);
  const draw = role === "floor" ? drawFloor : role === "wall" ? drawWall : role === "block" ? drawBlock : drawColumn;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const color = draw(mapId, x, y);
      const index = (y * SIZE + x) * 3;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
    }
  }
  return pixels;
}

function ppm(pixels: Uint8Array): Uint8Array {
  const header = new TextEncoder().encode(`P6\n${SIZE} ${SIZE}\n255\n`);
  const output = new Uint8Array(header.length + pixels.length);
  output.set(header);
  output.set(pixels, header.length);
  return output;
}

export const ARENA_TEXTURE_MAPS: readonly ArenaTextureMapId[] = ["ashgate", "hollowlanes", "maw", "perdition"];
export const ARENA_TEXTURE_ROLES: readonly ArenaTextureRole[] = ["floor", "wall", "block", "column"];

if (import.meta.main) {
  const root = process.argv[2];
  if (!root) throw new Error("usage: bun generate-arena-textures.ts <repo-root>");

  const sourceRoot = mkdtempSync(join(tmpdir(), "deadrot-arena-textures-"));
  try {
    for (const mapId of ARENA_TEXTURE_MAPS) {
      const destination = join(root, "packages/assets/games/scourge-survivors/textures/arenas", mapId);
      mkdirSync(destination, { recursive: true });
      for (const role of ARENA_TEXTURE_ROLES) {
        const source = join(sourceRoot, `${mapId}-${role}.ppm`);
        const target = join(destination, `${role}.webp`);
        writeFileSync(source, ppm(renderArenaTexture(mapId, role)));
        const result = Bun.spawnSync([
          process.env.CWEBP ?? "cwebp",
          "-quiet",
          "-lossless",
          "-exact",
          "-z",
          "9",
          "-m",
          "6",
          source,
          "-o",
          target,
        ]);
        if (result.exitCode !== 0) {
          throw new Error(`cwebp failed for ${mapId}/${role}: ${result.stderr.toString()}`);
        }
        console.log(`${mapId}/${role}`);
      }
    }
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true });
  }
}
