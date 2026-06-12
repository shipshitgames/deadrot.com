import type { AttackKind } from "./types";

export interface AttackSpec {
  kind: AttackKind;
  windup: number;
  duration: number;
  cooldown: number;
  range: number;
  push: number;
  shake: number;
}

export const ATTACKS: Record<AttackKind, AttackSpec> = {
  light: {
    kind: "light",
    windup: 0.07,
    duration: 0.22,
    cooldown: 0.28,
    range: 2.05,
    push: 1.6,
    shake: 0.08,
  },
  heavy: {
    kind: "heavy",
    windup: 0.16,
    duration: 0.34,
    cooldown: 0.58,
    range: 2.35,
    push: 2.8,
    shake: 0.16,
  },
  special: {
    kind: "special",
    windup: 0.2,
    duration: 0.46,
    cooldown: 1.15,
    range: 2.9,
    push: 3.8,
    shake: 0.28,
  },
};

export function guardedDamage(damage: number, blocking: boolean): number {
  return blocking ? Math.max(1, Math.round(damage * 0.28)) : damage;
}

export function attackDamage(
  kind: AttackKind,
  fighter: { lightDamage: number; heavyDamage: number; specialDamage: number },
): number {
  switch (kind) {
    case "light":
      return fighter.lightDamage;
    case "heavy":
      return fighter.heavyDamage;
    case "special":
      return fighter.specialDamage;
  }
}
