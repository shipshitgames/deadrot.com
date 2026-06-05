// Shared module-level constants + transient-entity interfaces, lifted verbatim
// from the top of the old Game.ts so the extracted systems can share them.
import * as THREE from 'three'
import type { Enemy } from '../entities/Enemy'
import type { PickupKind } from '../constants'

export const ENEMY_COLORS = [0xff5a3c, 0xffb02e, 0xff3b6b, 0x9b5cff, 0x2ee6a6, 0x4d9bff]
export const RANGED_COLOR = 0x35e0ff
export const WEAPON_VIEW_X = 0.45
export const WEAPON_VIEW_Y = -0.5
export const WEAPON_VIEW_Z = -0.72

export const PICKUP_COLORS: Record<PickupKind, number> = {
  health: 0xff4d6d,
  ammo: 0xded1aa,
  damage: 0xff7a1a,
  dual: 0xff6a00,
  pistol: 0xff6a00,
  smg: 0x9b5cff,
  shotgun: 0xffb02e,
  cannon: 0xff3b6b,
  sniper: 0xd7d2c4,
}

export interface Tracer {
  line: THREE.Line
  age: number
  ttl: number
}
export interface Pop {
  mesh: THREE.Mesh
  age: number
  ttl: number
  vel?: THREE.Vector3
  spin?: THREE.Vector3
  baseScale?: number
  growth?: number
  floor?: boolean
}
export interface Pickup {
  group: THREE.Group
  kind: PickupKind
  age: number
}
export interface Projectile {
  mesh: THREE.Sprite
  vel: THREE.Vector3
  damage: number
  age: number
  fromBoss: boolean
  baseScale: number
  spin: number
  owner: Enemy | null
}
