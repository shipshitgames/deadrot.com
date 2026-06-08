export type DirectionalSpriteView = "front" | "side" | "back";

export type DirectionalSpriteSector =
  | "front"
  | "front-right"
  | "right"
  | "back-right"
  | "back"
  | "back-left"
  | "left"
  | "front-left";

export interface DirectionalSpriteFrame {
  sector: DirectionalSpriteSector;
  view: DirectionalSpriteView;
  flip: number;
}

type MirrorBasis = "viewer" | "actor";

interface DirectionalSpriteOptions {
  fallback?: DirectionalSpriteFrame;
  mirrorBasis?: MirrorBasis;
  minLength?: number;
}

const DEFAULT_MIN_LENGTH = 0.0001;
const RIGHT_SUFFIXES = ["front-right", "right", "back-right"] as const;
const LEFT_SUFFIXES = ["front-left", "left", "back-left"] as const;

function defaultFallback(): DirectionalSpriteFrame {
  return { sector: "front", view: "front", flip: 1 };
}

function mirroredCross(actorX: number, actorZ: number, viewerX: number, viewerZ: number, basis: MirrorBasis): number {
  return basis === "actor" ? actorX * viewerZ - actorZ * viewerX : viewerX * actorZ - viewerZ * actorX;
}

function sectorForBucket(bucket: number, cross: number): DirectionalSpriteSector {
  if (bucket <= 0) return "front";
  if (bucket >= 4) return "back";
  const suffixes = cross >= 0 ? RIGHT_SUFFIXES : LEFT_SUFFIXES;
  return suffixes[bucket - 1];
}

function viewForBucket(bucket: number): DirectionalSpriteView {
  if (bucket <= 0) return "front";
  if (bucket >= 4) return "back";
  return "side";
}

/**
 * Converts an actor-facing or movement vector plus a vector to the viewer into
 * an 8-way logical sprite sector while keeping the current compact front/side/back
 * texture footprint. Diagonal sectors intentionally reuse the mirrored side view.
 */
export function chooseDirectionalSpriteFrame(
  actorX: number,
  actorZ: number,
  viewerX: number,
  viewerZ: number,
  options: DirectionalSpriteOptions = {},
): DirectionalSpriteFrame {
  const fallback = options.fallback ?? defaultFallback();
  const minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
  const actorLength = Math.hypot(actorX, actorZ);
  const viewerLength = Math.hypot(viewerX, viewerZ);
  if (actorLength < minLength || viewerLength < minLength) return fallback;

  const ax = actorX / actorLength;
  const az = actorZ / actorLength;
  const vx = viewerX / viewerLength;
  const vz = viewerZ / viewerLength;
  const dot = Math.max(-1, Math.min(1, ax * vx + az * vz));
  const cross = mirroredCross(ax, az, vx, vz, options.mirrorBasis ?? "viewer");
  const bucket = Math.min(4, Math.round(Math.abs(Math.atan2(cross, dot)) / (Math.PI / 4)));
  const view = viewForBucket(bucket);

  return {
    sector: sectorForBucket(bucket, cross),
    view,
    flip: view === "side" ? (cross >= 0 ? 1 : -1) : 1,
  };
}

export function chooseMovementDirectionalSpriteFrame(
  moveX: number,
  moveZ: number,
  viewerX: number,
  viewerZ: number,
  options: DirectionalSpriteOptions = {},
): DirectionalSpriteFrame {
  const minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
  const moving = Math.hypot(moveX, moveZ) >= minLength;
  return chooseDirectionalSpriteFrame(moving ? moveX : viewerX, moving ? moveZ : viewerZ, viewerX, viewerZ, options);
}
