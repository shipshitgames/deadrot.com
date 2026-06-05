import * as THREE from 'three'
import {
  BOSS_BARRAGE_COUNT,
  BOSS_BARRAGE_SPREAD,
  BOSS_ENRAGE_HEALTH_FRAC,
  BOSS_ENRAGE_SPEED_MULT,
  BOSS_SHIELD_DURATION,
  BOSS_SKILL_INTERVAL,
  ENEMY_ATTACK_DAMAGE,
  ENEMY_ATTACK_INTERVAL,
  ENEMY_ATTACK_RANGE,
  ENEMY_FIRE_INTERVAL,
  ENEMY_FIRE_RANGE,
  ENEMY_MAX_HEALTH,
  ENEMY_PREFERRED_RANGE,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED,
  ENEMY_RADIUS,
  ENEMY_SEPARATION,
  ENEMY_SPEED_MIN,
  ENEMY_SPEED_MAX,
} from '../constants'
import { ENEMY_SPRITE_SCALES, ENEMY_SPRITE_TEXTURES } from '../spriteAssets'
import { ENEMY_ARCHETYPES, type EnemyArchetypeId } from '../data/enemies'
import { Agent, type WorldBounds, type SteeringStrategy, type PlanarVec } from '@shipshitgames/engine'
import { chasePlayerStrategy } from './ChasePlayerStrategy'

const HEALTHBAR_WIDTH = 0.95
type EnemySpriteKind = 'melee' | 'ranged' | 'flying' | 'boss'
type EnemySpriteView = 'front' | 'side' | 'back'

export interface DamageResult {
  died: boolean
  headshot: boolean
  blocked: boolean
}

/** A single shot the enemy wants to fire this frame. */
export interface EnemyShot {
  origin: THREE.Vector3
  dir: THREE.Vector3
  damage: number
  speed: number
  fromBoss: boolean
}

export interface EnemyTick {
  melee: number
  shots: EnemyShot[]
}

export interface SpawnConfig {
  archetype?: EnemyArchetypeId
  maxHealth?: number
  speed?: number
  scale?: number
  color?: number
  isBoss?: boolean
  ranged?: boolean
  flying?: boolean
  hoverHeight?: number
  splitCount?: number
  attackDamage?: number
  attackInterval?: number
  attackRange?: number
  projectileDamage?: number
  projectileSpeed?: number
  preferredRange?: number
}

/**
 * A single enemy "bot". Melee bots close in and swipe; ranged bots keep their
 * distance and fire projectiles. The boss does both and runs an ability cycle
 * (shield / enrage / projectile barrage). The {@link Game} owns the pool, spawns
 * per wave, resolves obstacle collision and turns {@link EnemyShot}s into live
 * projectiles.
 */
export class Enemy extends Agent {
  readonly group = new THREE.Group()
  readonly hitMeshes: THREE.Mesh[] = []

  maxHealth = ENEMY_MAX_HEALTH
  health = ENEMY_MAX_HEALTH
  isBoss = false
  ranged = false
  flying = false
  hoverHeight = 0
  archetype: EnemyArchetypeId = 'grunt'
  splitCount = 0
  /** Set by the steering strategy: a ranged bot backing off holds its fire. */
  retreating = false

  // hit reaction: a brief white-hot flash + scale punch so bullets visibly
  // CONNECT (set by takeDamage). The decaying knockback shove lives on Agent.
  hitFlash = 0
  staggerTimer = 0
  private telegraphTimer = 0
  private chargeWindup = 0
  private chargeTimer = 0
  private chargeCooldown = 0
  private chargeDirX = 0
  private chargeDirZ = 0

  /** Pluggable movement policy (default: the Scourge chase/kite steering). */
  private steering: SteeringStrategy<Enemy> = chasePlayerStrategy

  // boss ability state
  shielded = false
  enraged = false

  private attackDamage = ENEMY_ATTACK_DAMAGE
  private attackInterval = ENEMY_ATTACK_INTERVAL
  /** Read by the steering strategy: melee closes inside this range. */
  attackRange = ENEMY_ATTACK_RANGE
  private projectileDamage = ENEMY_PROJECTILE_DAMAGE
  private projectileSpeed = ENEMY_PROJECTILE_SPEED
  /** Read by the steering strategy: ranged bots hold this gap. */
  preferredRange = ENEMY_PREFERRED_RANGE
  private fireInterval = ENEMY_FIRE_INTERVAL

  private baseSpeed = ENEMY_SPEED_MIN
  private baseAttackInterval = ENEMY_ATTACK_INTERVAL
  private shieldTimer = 0
  private skillTimer = BOSS_SKILL_INTERVAL
  private skillToggle = 0

  private attackTimer = 0
  private fireTimer = 0
  private bobPhase = 0
  /** Read by the steering strategy: which way a ranged bot strafes. */
  strafeSign = 1

  private bodyMat: THREE.MeshStandardMaterial
  private eyeMat: THREE.MeshStandardMaterial
  private healthFill: THREE.Mesh
  private healthBarGroup = new THREE.Group()
  private shieldMesh: THREE.Mesh
  private tellMesh: THREE.Mesh
  private spriteMat: THREE.SpriteMaterial
  private sprite: THREE.Sprite
  private spriteView: EnemySpriteView = 'front'
  private spriteFlip = 1
  private muzzle = new THREE.Vector3()

  constructor() {
    super()
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff5a3c, emissive: 0x000000, roughness: 0.55, metalness: 0.25,
    })

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.55), this.bodyMat)
    legs.position.y = 0.35
    legs.castShadow = true
    legs.userData = { enemy: this, part: 'body' }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.6), this.bodyMat)
    torso.position.y = 1.08
    torso.castShadow = true
    torso.userData = { enemy: this, part: 'body' }

    const headMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4, metalness: 0.5 })
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), headMat)
    head.position.y = 1.78
    head.castShadow = true
    head.userData = { enemy: this, part: 'head' }

    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff3b30, emissiveIntensity: 2.2 })
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.06)
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMat)
    eyeL.position.set(-0.13, 1.82, 0.3)
    const eyeR = new THREE.Mesh(eyeGeo, this.eyeMat)
    eyeR.position.set(0.13, 1.82, 0.3)

    for (const part of [legs, torso, head, eyeL, eyeR]) part.visible = false
    this.group.add(legs, torso, head, eyeL, eyeR)
    this.hitMeshes.push(legs, torso, head)

    this.spriteMat = new THREE.SpriteMaterial({
      map: ENEMY_SPRITE_TEXTURES.melee.front,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.06,
      depthWrite: true,
      toneMapped: false,
    })
    this.sprite = new THREE.Sprite(this.spriteMat)
    this.sprite.center.set(0.5, 0)
    this.sprite.position.y = 0
    this.group.add(this.sprite)

    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTHBAR_WIDTH + 0.08, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }),
    )
    this.healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTHBAR_WIDTH, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff6a00, depthWrite: false }),
    )
    this.healthFill.position.z = 0.001
    this.healthBarGroup.add(barBg, this.healthFill)
    this.healthBarGroup.position.y = 2.45
    this.group.add(this.healthBarGroup)

    // Boss shield bubble (hidden unless the boss raises it).
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0x39c7ff, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    )
    this.shieldMesh.position.y = 1.2
    this.shieldMesh.visible = false
    this.group.add(this.shieldMesh)

    this.tellMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.46, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.tellMesh.position.y = 1.35
    this.tellMesh.visible = false
    this.group.add(this.tellMesh)

    this.group.visible = false
    this.group.position.y = -100
  }

  spawnAt(x: number, z: number, cfg: SpawnConfig = {}) {
    this.archetype = cfg.archetype ?? (cfg.ranged ? 'shooter' : 'grunt')
    const archetype = ENEMY_ARCHETYPES[this.archetype]
    this.maxHealth = cfg.maxHealth ?? ENEMY_MAX_HEALTH
    this.health = this.maxHealth
    this.alive = true
    this.isBoss = cfg.isBoss ?? false
    this.ranged = cfg.ranged ?? archetype.ranged ?? false
    this.flying = cfg.flying ?? archetype.flying ?? false
    this.hoverHeight = this.flying ? (cfg.hoverHeight ?? archetype.hoverHeight ?? 2.05) : 0
    this.splitCount = cfg.splitCount ?? archetype.splitCount ?? 0
    this.baseSpeed = cfg.speed ?? ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN)
    this.speed = this.baseSpeed
    this.baseAttackInterval = cfg.attackInterval ?? ENEMY_ATTACK_INTERVAL
    this.attackInterval = this.baseAttackInterval
    this.attackDamage = cfg.attackDamage ?? archetype.attackDamage ?? ENEMY_ATTACK_DAMAGE
    this.attackRange = cfg.attackRange ?? ENEMY_ATTACK_RANGE
    this.projectileDamage = cfg.projectileDamage ?? ENEMY_PROJECTILE_DAMAGE
    this.projectileSpeed = cfg.projectileSpeed ?? ENEMY_PROJECTILE_SPEED
    this.preferredRange = cfg.preferredRange ?? ENEMY_PREFERRED_RANGE
    this.fireInterval = ENEMY_FIRE_INTERVAL

    this.attackTimer = this.attackInterval
    this.fireTimer = this.fireInterval * (0.5 + Math.random())
    this.bobPhase = Math.random() * Math.PI * 2
    this.strafeSign = Math.random() < 0.5 ? -1 : 1

    this.shielded = false
    this.enraged = false
    this.shieldTimer = 0
    this.skillTimer = BOSS_SKILL_INTERVAL
    this.skillToggle = 0
    this.shieldMesh.visible = false
    this.hitFlash = 0
    this.staggerTimer = 0
    this.telegraphTimer = 0
    this.chargeWindup = 0
    this.chargeTimer = 0
    this.chargeCooldown = 1.1 + Math.random() * 1.2
    this.knockX = 0
    this.knockZ = 0
    this.tellMesh.visible = false

    const scale = cfg.scale ?? 1
    this.group.scale.setScalar(scale)
    this.radius = ENEMY_RADIUS * (this.isBoss ? scale * 0.8 : this.flying ? scale * 0.72 : 1)

    this.applyStyle(cfg.color ?? 0xff5a3c)
    this.applySprite()
    this.group.position.set(x, this.hoverHeight, z)
    this.group.visible = true
    this.updateHealthBar()
  }

  private spriteKind(): EnemySpriteKind {
    if (this.isBoss) return 'boss'
    if (this.flying) return 'flying'
    return this.ranged ? 'ranged' : 'melee'
  }

  private applySprite(view: EnemySpriteView = 'front', flip = 1, elapsed = 0, moving = false) {
    const kind = this.spriteKind()
    const texture = ENEMY_SPRITE_TEXTURES[kind][view]

    if (this.spriteMat.map !== texture) {
      this.spriteMat.map = texture
      this.spriteMat.needsUpdate = true
    }
    this.spriteView = view
    this.spriteFlip = flip

    const [baseW, baseH] = ENEMY_SPRITE_SCALES[kind][view]
    const step = moving ? Math.sin(elapsed * (this.speed * 2.8) + this.bobPhase) : 0
    const squash = Math.abs(step)
    // hit-flash: blow the sprite white-hot and punch its scale up briefly
    const flash = this.hitFlash > 0 ? this.hitFlash / 0.08 : 0
    if (flash > 0) this.spriteMat.color.setRGB(1 + flash * 1.5, 1 + flash * 1.15, 1 + flash * 0.9)
    else this.spriteMat.color.setHex(0xffffff)
    const punch = 1 + flash * 0.26
    if (flash <= 0 && (this.telegraphTimer > 0 || this.chargeWindup > 0)) {
      this.spriteMat.color.setHex(this.archetype === 'shooter' ? 0xbdefff : 0xffd166)
    } else if (flash <= 0 && this.staggerTimer > 0) {
      this.spriteMat.color.setRGB(1.2, 0.78, 0.78)
    }
    this.spriteMat.rotation = moving ? step * 0.035 * flip : 0
    this.sprite.scale.set(baseW * (1 + squash * 0.025) * flip * punch, baseH * (1 - squash * 0.035) * punch, 1)
    this.sprite.position.y = moving ? squash * 0.035 : 0
  }

  private chooseSpriteFrame(moveX: number, moveZ: number, dirX: number, dirZ: number): { view: EnemySpriteView; flip: number } {
    const moveLen = Math.hypot(moveX, moveZ)
    if (moveLen < 0.05) return { view: this.spriteView, flip: this.spriteFlip }

    const mx = moveX / moveLen
    const mz = moveZ / moveLen
    const dot = mx * dirX + mz * dirZ
    if (dot > 0.5) return { view: 'front', flip: 1 }
    if (dot < -0.45) return { view: 'back', flip: 1 }

    const cross = dirX * mz - dirZ * mx
    return { view: 'side', flip: cross >= 0 ? 1 : -1 }
  }

  private applyStyle(color: number) {
    if (this.isBoss) {
      this.bodyMat.color.setHex(color)
      this.bodyMat.emissive.setHex(color)
      this.bodyMat.emissiveIntensity = 0.9
      this.bodyMat.metalness = 0.1
      this.bodyMat.roughness = 0.45
      this.eyeMat.emissive.setHex(0xffe000)
      this.eyeMat.emissiveIntensity = 4
      ;(this.healthFill.material as THREE.MeshBasicMaterial).color.setHex(0xff2d55)
    } else {
      const c = new THREE.Color(color)
      this.bodyMat.color.setHex(color)
      this.bodyMat.emissive.copy(c).multiplyScalar(this.ranged ? 0.45 : 0.22)
      this.bodyMat.emissiveIntensity = 1
      this.bodyMat.metalness = 0.25
      this.bodyMat.roughness = 0.55
      this.eyeMat.emissive.setHex(this.ranged ? 0x35e0ff : 0xff3b30)
      this.eyeMat.emissiveIntensity = this.ranged ? 3 : 2.2
    }
  }

  /** Advance one frame. Obstacle collision is resolved by the Game afterwards. */
  update(
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    peers: Enemy[],
    cameraQuat: THREE.Quaternion,
    bounds: WorldBounds,
  ): EnemyTick {
    const tick: EnemyTick = { melee: 0, shots: [] }
    if (!this.alive) return tick

    const pos = this.group.position
    const dx = playerPos.x - pos.x
    const dz = playerPos.z - pos.z
    const dist = Math.hypot(dx, dz)
    const dirX = dist > 0.0001 ? dx / dist : 0
    const dirZ = dist > 0.0001 ? dz / dist : 0

    const move: PlanarVec = { x: 0, z: 0 }

    if (this.staggerTimer > 0) this.staggerTimer = Math.max(0, this.staggerTimer - delta)
    if (this.chargeCooldown > 0) this.chargeCooldown = Math.max(0, this.chargeCooldown - delta)

    const canCharge = !this.isBoss && this.archetype === 'charger' && dist > 4.5 && dist < 18
    if (canCharge && this.chargeCooldown <= 0 && this.chargeWindup <= 0 && this.chargeTimer <= 0) {
      this.chargeWindup = 0.42
      this.chargeDirX = dirX
      this.chargeDirZ = dirZ
      this.eyeMat.emissiveIntensity = 6
    }

    let suppressSteering = false
    if (this.chargeWindup > 0) {
      this.chargeWindup -= delta
      this.chargeDirX = dirX
      this.chargeDirZ = dirZ
      suppressSteering = true
      if (this.chargeWindup <= 0) {
        this.chargeTimer = 0.55
        this.chargeCooldown = 3.2 + Math.random() * 1.2
      }
    }

    if (this.chargeTimer > 0) {
      this.chargeTimer = Math.max(0, this.chargeTimer - delta)
      move.x += this.chargeDirX * this.speed * 3.1
      move.z += this.chargeDirZ * this.speed * 3.1
    } else if (!suppressSteering) {
      // separation (boids peer-repulsion), scaled into the move intent
      this.separation(peers, ENEMY_SEPARATION, move, (other) => (this.isBoss || other.isBoss ? 1.2 : 0))
      move.x *= this.speed * 0.6
      move.z *= this.speed * 0.6

      // steering intent (chase / kite / strafe) added on top of separation
      this.steering.desiredVelocity(this, { dist, dirX, dirZ }, move)
    }

    const staggerMoveMul = this.staggerTimer > 0 ? (this.isBoss ? 0.72 : this.archetype === 'tank' ? 0.48 : 0.18) : 1
    move.x *= staggerMoveMul
    move.z *= staggerMoveMul
    pos.x += move.x * delta
    pos.z += move.z * delta

    // knockback shove from being shot — decays fast so it reads as a flinch
    this.applyKnockback(delta)
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - delta)

    bounds.clampXZ(pos, 1.5)

    this.group.rotation.y = Math.atan2(dirX, dirZ)
    pos.y = this.flying
      ? this.hoverHeight + Math.sin(elapsed * (this.speed * 1.25) + this.bobPhase) * 0.18
      : Math.abs(Math.sin(elapsed * (this.speed * 1.6) + this.bobPhase)) * 0.07
    const frame = this.chooseSpriteFrame(move.x, move.z, dirX, dirZ)
    this.applySprite(frame.view, frame.flip, elapsed, Math.hypot(move.x, move.z) > 0.05)
    this.healthBarGroup.quaternion.copy(cameraQuat)
    this.updateTell(delta)

    // ---- boss abilities
    if (this.isBoss) this.updateBoss(delta, elapsed, dirX, dirZ, dist, playerPos, tick)

    // ---- melee
    const canAct = this.staggerTimer <= 0.02 && this.chargeWindup <= 0
    if (canAct && dist <= this.attackRange) {
      this.attackTimer -= delta
      if (this.attackTimer <= 0) {
        tick.melee += this.attackDamage
        this.attackTimer = this.attackInterval
        this.eyeMat.emissiveIntensity = this.isBoss ? 7 : 4.5
      }
    }
    const restEye = this.isBoss ? 4 : this.ranged ? 3 : 2.2
    if (this.eyeMat.emissiveIntensity > restEye) {
      this.eyeMat.emissiveIntensity = Math.max(restEye, this.eyeMat.emissiveIntensity - delta * 12)
    }

    // ---- ranged fire (mobs and boss). Mobs hold fire while backing away.
    if (canAct && (this.isBoss || this.ranged || this.telegraphTimer > 0) && dist <= ENEMY_FIRE_RANGE) {
      if (this.telegraphTimer > 0) {
        this.telegraphTimer -= delta
        if (this.telegraphTimer <= 0) {
          tick.shots.push(this.makeShot(playerPos, 0))
          this.fireTimer = this.fireInterval * (this.enraged ? 0.6 : 1)
        }
      } else if (this.isBoss || !this.retreating) {
        this.fireTimer -= delta
        if (this.fireTimer <= 0) {
          this.telegraphTimer = this.isBoss ? 0.16 : 0.34
          this.eyeMat.emissiveIntensity = this.isBoss ? 7 : 5.6
        }
      }
    } else if (this.telegraphTimer > 0) {
      this.telegraphTimer -= delta
      if (this.telegraphTimer <= 0 && canAct) {
        tick.shots.push(this.makeShot(playerPos, 0))
        this.fireTimer = this.fireInterval * (this.enraged ? 0.6 : 1)
      }
    }

    return tick
  }

  private updateTell(delta: number) {
    const active = this.telegraphTimer > 0 || this.chargeWindup > 0
    this.tellMesh.visible = active
    if (!active) return
    const mat = this.tellMesh.material as THREE.MeshBasicMaterial
    const isShot = this.telegraphTimer > 0
    mat.color.setHex(isShot ? 0x7fd8ff : 0xffb02e)
    mat.opacity = isShot
      ? 0.38 + Math.sin(this.telegraphTimer * 48) * 0.18
      : 0.52 + Math.sin(this.chargeWindup * 40) * 0.2
    this.tellMesh.rotation.z += delta * (isShot ? -7 : 10)
    const pulse = isShot ? 1 + Math.sin(this.telegraphTimer * 34) * 0.16 : 1.2 + Math.sin(this.chargeWindup * 30) * 0.24
    this.tellMesh.scale.setScalar(pulse)
  }

  private updateBoss(
    delta: number,
    elapsed: number,
    dirX: number,
    dirZ: number,
    dist: number,
    playerPos: THREE.Vector3,
    tick: EnemyTick,
  ) {
    // Enrage once below the health threshold.
    if (!this.enraged && this.health / this.maxHealth < BOSS_ENRAGE_HEALTH_FRAC) {
      this.enraged = true
      this.speed = this.baseSpeed * BOSS_ENRAGE_SPEED_MULT
      this.attackInterval = this.baseAttackInterval * 0.6
    }

    // Shield lifetime + pulse.
    if (this.shielded) {
      this.shieldTimer -= delta
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial
      m.opacity = 0.22 + Math.sin(elapsed * 10) * 0.1
      if (this.shieldTimer <= 0) {
        this.shielded = false
        this.shieldMesh.visible = false
      }
    }

    // Ability cycle.
    this.skillTimer -= delta
    if (this.skillTimer <= 0) {
      if (this.skillToggle % 2 === 0) {
        // raise shield
        this.shielded = true
        this.shieldTimer = BOSS_SHIELD_DURATION
        this.shieldMesh.visible = true
      } else {
        // projectile barrage fanned around the player direction
        const base = Math.atan2(dirX, dirZ)
        const denom = Math.max(1, BOSS_BARRAGE_COUNT - 1)
        for (let i = 0; i < BOSS_BARRAGE_COUNT; i++) {
          const t = i / denom - 0.5
          const ang = base + t * BOSS_BARRAGE_SPREAD
          tick.shots.push(this.makeShotAngle(playerPos, ang))
        }
      }
      this.skillToggle++
      this.skillTimer = BOSS_SKILL_INTERVAL * (this.enraged ? 0.7 : 1)
    }
  }

  private chestOrigin(): THREE.Vector3 {
    const s = this.group.scale.y
    return this.muzzle.set(this.group.position.x, this.group.position.y + 1.25 * s, this.group.position.z)
  }

  private makeShot(playerPos: THREE.Vector3, jitter: number): EnemyShot {
    const origin = this.chestOrigin().clone()
    const dir = new THREE.Vector3(playerPos.x - origin.x, playerPos.y - origin.y, playerPos.z - origin.z).normalize()
    const j = jitter || (this.isBoss ? 0.02 : 0.045)
    dir.x += (Math.random() * 2 - 1) * j
    dir.y += (Math.random() * 2 - 1) * j * 0.5
    dir.z += (Math.random() * 2 - 1) * j
    dir.normalize()
    return { origin, dir, damage: this.projectileDamage, speed: this.projectileSpeed, fromBoss: this.isBoss }
  }

  private makeShotAngle(playerPos: THREE.Vector3, yaw: number): EnemyShot {
    const origin = this.chestOrigin().clone()
    // aim slightly up toward the player's height, fanned on the yaw
    const dy = (playerPos.y - origin.y) * 0.15
    const dir = new THREE.Vector3(Math.sin(yaw), dy, Math.cos(yaw)).normalize()
    return { origin, dir, damage: this.projectileDamage, speed: this.projectileSpeed, fromBoss: this.isBoss }
  }

  takeDamage(amount: number, headshot: boolean, knock = 0, kx = 0, kz = 0): DamageResult {
    if (!this.alive) return { died: false, headshot, blocked: false }
    if (this.shielded) {
      // flash the shield to acknowledge the blocked hit
      const m = this.shieldMesh.material as THREE.MeshBasicMaterial
      m.opacity = 0.6
      return { died: false, headshot, blocked: true }
    }
    this.health = Math.max(0, this.health - amount)
    this.hitFlash = headshot ? 0.12 : 0.08
    const archetype = ENEMY_ARCHETYPES[this.archetype]
    const baseStagger = (headshot ? 0.2 : 0.075) + Math.min(0.08, amount / 900)
    const bossMul = this.isBoss ? 0.3 : 1
    this.staggerTimer = Math.max(this.staggerTimer, baseStagger * archetype.staggerMul * bossMul)
    if (headshot && this.archetype === 'charger') {
      this.chargeWindup = 0
      this.chargeTimer *= 0.35
    }
    if (knock > 0) {
      // heavier enemies barely budge; overwrite (not add) so multi-pellet hits don't launch
      const mass = this.isBoss ? 7 : archetype.mass
      const headshotBoost = headshot ? 1.45 : 1
      this.knockX = kx * ((knock * headshotBoost) / mass)
      this.knockZ = kz * ((knock * headshotBoost) / mass)
    }
    this.updateHealthBar()
    if (this.health <= 0) {
      this.kill()
      return { died: true, headshot, blocked: false }
    }
    return { died: false, headshot, blocked: false }
  }

  kill() {
    // isBoss left intact so death handlers can detect a boss kill; reset on next spawn.
    this.alive = false
    this.shielded = false
    this.shieldMesh.visible = false
    this.tellMesh.visible = false
    this.group.visible = false
    this.group.position.y = -100
  }

  get position(): THREE.Vector3 {
    return this.group.position
  }

  private updateHealthBar() {
    const frac = Math.max(0, this.health / this.maxHealth)
    this.healthFill.scale.x = frac
    this.healthFill.position.x = -(HEALTHBAR_WIDTH / 2) * (1 - frac)
    const mat = this.healthFill.material as THREE.MeshBasicMaterial
    if (this.isBoss) mat.color.setHex(0xff2d55)
    else mat.color.setHex(frac > 0.45 ? 0xff6a00 : 0xc1121f)
    this.healthBarGroup.visible = this.isBoss || frac < 0.999
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })
  }
}
