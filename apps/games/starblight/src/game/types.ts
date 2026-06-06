import type * as THREE from 'three'
import type { EnemyType } from './constants'
import type { UpgradeId } from './upgrades'

export type GamePhase = 'title' | 'playing' | 'levelup' | 'gameover' | 'victory'

// --- HUD snapshot -----------------------------------------------------------
// Public, serializable state the HUD adapter consumes each frame.
export interface BuildChip {
  id: UpgradeId
  icon: string
  name: string
  level: number
  max: number
  kind: 'weapon' | 'passive'
}

export interface DraftCard {
  id: UpgradeId
  name: string
  desc: string
  icon: string
  kind: 'weapon' | 'passive'
  level: number // current level (0 = not yet owned)
  max: number
}

export interface HudState {
  phase: GamePhase
  level: number
  xp01: number // 0..1 progress to next level
  timeSec: number
  integrity: number
  maxIntegrity: number
  gems: number
  kills: number
  build: BuildChip[]
  draft: DraftCard[] | null
  bossHp01: number | null // boss health 0..1, or null when no boss
  lowIntegrity: boolean
}

export type HudListener = (state: HudState) => void

// --- Entity records ---------------------------------------------------------

export interface Enemy {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  type: EnemyType
  health: number
  maxHealth: number
  speed: number
  gemValue: number
  contactDmg: number
  radius: number
  flash: number // hit-flash timer (seconds remaining)
  phase: number // weave/pulse phase offset
  fireCooldown: number // spitter shot timer
  vx: number // knockback drift
  vy: number
  knockbackImmune: boolean
  boss: boolean // prototype Blight-Maw / Orbital Breach Carrier encounter
  dead: boolean
}

export interface Bullet {
  mesh: THREE.Mesh
  vx: number
  vy: number
  damage: number
  pierce: number
  homing: boolean
  turnRate: number
  target: Enemy | null
  hit: Enemy[] // enemies already struck (so a piercing bolt won't re-hit)
  life: number
  dead: boolean
}

export interface EnemyBullet {
  mesh: THREE.Mesh
  vx: number
  vy: number
  damage: number
  life: number
  dead: boolean
}

export interface Gem {
  mesh: THREE.Mesh
  value: number
  age: number
  homing: boolean
  spawn: number // 0..1 spawn-pop animation
  dead: boolean
}

export interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  life: number
  maxLife: number
}
