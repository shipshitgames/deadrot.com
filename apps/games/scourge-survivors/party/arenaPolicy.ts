export const ARENA_POLICY = {
  maxFrameChars: 1_024,
  arenaHalf: 40,
  playerRadius: 0.5,
  minY: 0.7,
  maxY: 8,
  maxHorizontalSpeed: 18,
  movementSlack: 1.5,
  maxCatchupSeconds: 0.25,
  rateWindowMs: 1_000,
  maxStateFramesPerWindow: 30,
  maxHitFramesPerWindow: 40,
  maxJoinFramesPerWindow: 4,
  maxHitRange: 90,
  maxClaimDamage: 300,
} as const;

export const ARENA_WEAPON_NAMES = ["Pistol", "SMG", "Shotgun", "Cannon", "Sniper"] as const;

export interface ArenaFrame {
  t?: string;
  [key: string]: unknown;
}

export interface AcceptedPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  acceptedAt: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Parse only the small JSON object frames this preview protocol accepts. */
export function parseArenaFrame(raw: string): ArenaFrame | null {
  if (raw.length === 0 || raw.length > ARENA_POLICY.maxFrameChars) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as ArenaFrame) : null;
  } catch {
    return null;
  }
}

export function sanitizePlayerName(value: unknown): string {
  const withoutControls = [...String(value ?? "Player")]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("");
  const clean = withoutControls.trim().slice(0, 16);
  return clean || "Player";
}

export function normalizeAvatarId(value: unknown): string {
  const id = String(value ?? "ranger");
  return ["ranger", "heavy", "scout", "medic"].includes(id) ? id : "ranger";
}

export function acceptWeaponName(value: unknown, fallback: string): string {
  return typeof value === "string" && (ARENA_WEAPON_NAMES as readonly string[]).includes(value) ? value : fallback;
}

export function normalizeYaw(value: number): number {
  const wrapped = ((((value + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

/**
 * Accept a client-owned pose only after finite/bounds/speed checks. Movement is
 * capped rather than dropped so a bad jump cannot leave a peer permanently out
 * of sync; the returned transform is the one the server records and broadcasts.
 */
export function acceptClientPose(current: AcceptedPose, frame: ArenaFrame, now: number): AcceptedPose | null {
  if (![frame.x, frame.y, frame.z, frame.yaw].every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }
  const x = frame.x as number;
  const y = frame.y as number;
  const z = frame.z as number;
  const yaw = frame.yaw as number;
  if (![x, y, z, yaw, now].every(Number.isFinite)) return null;

  const edge = ARENA_POLICY.arenaHalf - ARENA_POLICY.playerRadius;
  const desiredX = clamp(x, -edge, edge);
  const desiredZ = clamp(z, -edge, edge);
  const elapsed = clamp((now - current.acceptedAt) / 1_000, 0, ARENA_POLICY.maxCatchupSeconds);
  const maxStep = ARENA_POLICY.movementSlack + ARENA_POLICY.maxHorizontalSpeed * elapsed;
  const dx = desiredX - current.x;
  const dz = desiredZ - current.z;
  const distance = Math.hypot(dx, dz);
  const scale = distance > maxStep && distance > 0 ? maxStep / distance : 1;

  return {
    x: current.x + dx * scale,
    y: clamp(y, ARENA_POLICY.minY, ARENA_POLICY.maxY),
    z: current.z + dz * scale,
    yaw: normalizeYaw(yaw),
    acceptedAt: now,
  };
}

/** Return the next rolling-window history, or null when the operation is over cadence. */
export function acceptCadence(history: readonly number[], now: number, maxFrames: number): number[] | null {
  if (!Number.isFinite(now)) return null;
  const cutoff = now - ARENA_POLICY.rateWindowMs;
  const recent = history.filter((stamp) => stamp > cutoff);
  if (recent.length >= maxFrames) return null;
  return [...recent, now];
}

/** Validate a PvP damage claim against accepted server transforms and preview limits. */
export function acceptDamageClaim(
  shooter: Pick<AcceptedPose, "x" | "z">,
  target: Pick<AcceptedPose, "x" | "z">,
  value: unknown,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const damage = value;
  if (damage <= 0 || damage > ARENA_POLICY.maxClaimDamage) return null;
  if (Math.hypot(target.x - shooter.x, target.z - shooter.z) > ARENA_POLICY.maxHitRange) return null;
  return Math.round(damage * 100) / 100;
}
