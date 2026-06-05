import * as THREE from 'three'
import type { StateListener } from './types'
import type { PlayerAvatarId } from '../net/playerAvatars'
import { GameContext } from './context'
import type { GameSystems } from './systems'
import { DEFAULT_MAP_ID, getMap } from './data/maps'
import type { SurvivorClassId } from './data/survivors'
import { ENEMY_ARCHETYPES } from './data/enemies'
import { RenderSystem } from './render/RenderSystem'
import { ArenaSystem } from './render/ArenaSystem'
import { PlayerSystem } from './entities/PlayerSystem'
import { WeaponSystem } from './entities/WeaponSystem'
import { ProjectilesSystem } from './entities/ProjectilesSystem'
import { PickupsSystem } from './entities/PickupsSystem'
import { FxSystem } from './entities/FxSystem'
import { PveDirectorSystem } from './modes/PveDirectorSystem'
import { SurvivorsSystem } from './modes/SurvivorsSystem'
import { MultiplayerSystem } from './modes/MultiplayerSystem'
import { GameOverSystem } from './modes/GameOverSystem'
import { InputSystem } from './systems/InputSystem'
import { HudSystem } from './systems/HudSystem'
import {
  BOSS_ATTACK_DAMAGE,
  BOSS_ATTACK_INTERVAL,
  BOSS_ATTACK_RANGE,
  BOSS_COLOR,
  BOSS_HEALTH,
  BOSS_PROJECTILE_DAMAGE,
  BOSS_PROJECTILE_SPEED,
  BOSS_SCALE,
  BOSS_SPEED,
  ENEMY_ATTACK_DAMAGE,
  ENEMY_ATTACK_INTERVAL,
  ENEMY_ATTACK_RANGE,
  ENEMY_MAX_HEALTH,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED,
  ENEMY_SPEED_MIN,
  PICKUP_TTL,
  STARTING_WEAPON,
  WEAPON_ORDER,
  WEAPONS,
  type PickupKind,
  type WeaponId,
} from './constants'

export type SandboxEnemyKind = 'melee' | 'ranged' | 'flying' | 'boss'

/**
 * Thin orchestrator: owns the shared GameContext + the system registry, runs the
 * rAF loop, and exposes the public API (delegating to systems). All gameplay
 * lives in the systems under ./render ./entities ./modes ./systems.
 */
export class Game {
  private ctx: GameContext
  private sys: GameSystems

  constructor(container: HTMLElement, listener: StateListener) {
    const ctx = new GameContext(container, listener)
    this.ctx = ctx
    // Systems only call siblings at runtime, so the construction order is
    // irrelevant — every entry of `sys` is populated before the loop starts.
    const sys = {} as GameSystems
    this.sys = sys
    sys.render = new RenderSystem(ctx, sys)
    sys.arena = new ArenaSystem(ctx, sys)
    sys.player = new PlayerSystem(ctx, sys)
    sys.weapon = new WeaponSystem(ctx, sys)
    sys.projectiles = new ProjectilesSystem(ctx, sys)
    sys.pickups = new PickupsSystem(ctx, sys)
    sys.fx = new FxSystem(ctx, sys)
    sys.pve = new PveDirectorSystem(ctx, sys)
    sys.survivors = new SurvivorsSystem(ctx, sys)
    sys.multiplayer = new MultiplayerSystem(ctx, sys)
    sys.input = new InputSystem(ctx, sys)
    sys.hud = new HudSystem(ctx, sys)
    sys.gameOver = new GameOverSystem(ctx, sys)
  }

  // ---------------------------------------------------------------- lifecycle

  start() {
    this.sys.render.setupRenderer()
    this.sys.render.setupScene()
    this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID))
    this.sys.weapon.buildWeapon()
    this.sys.input.bindEvents()
    this.sys.survivors.init()
    this.sys.player.resetPlayer()
    this.sys.pve.startWaveSystem()
    this.ctx.clock.start()
    this.sys.hud.emit()
    this.loop()
  }

  private loop = () => {
    if (this.ctx.disposed) return
    this.ctx.raf = requestAnimationFrame(this.loop)

    const realDelta = Math.min(this.ctx.clock.getDelta(), 0.1)
    const elapsed = this.ctx.clock.elapsedTime

    // Hitstop: briefly freeze the SIM (not the render/HUD) on big impacts so
    // kills/headshots/cannon land with a punch. Tiny by design (<~80ms).
    let delta = realDelta
    if (this.ctx.hitstopTimer > 0) {
      this.ctx.hitstopTimer -= realDelta
      delta = realDelta * 0.05
    }

    if (this.ctx.status === 'playing') this.update(delta, elapsed)
    else if (this.ctx.status !== 'paused') this.sys.fx.updateEffects(realDelta)
    // When paused, nothing simulates — the frame is just re-rendered as-is.

    this.sys.hud.emitAccumulator += realDelta
    if (this.sys.hud.emitAccumulator >= 0.1) {
      this.sys.hud.emitAccumulator = 0
      this.sys.hud.emit()
    }

    // End-of-frame: advance the camera rig AFTER body movement + collision,
    // BEFORE the draw (no-op for the FPS preset; the follow-cam needs it).
    this.ctx.rig.update(realDelta)
    this.sys.render.render()
  }

  private update(delta: number, elapsed: number) {
    this.ctx.time += delta
    if (this.ctx.damageBoostTimer > 0) this.ctx.damageBoostTimer = Math.max(0, this.ctx.damageBoostTimer - delta)
    if (this.ctx.dualWeaponTimer > 0) this.ctx.dualWeaponTimer = Math.max(0, this.ctx.dualWeaponTimer - delta)
    this.sys.weapon.tickMeleeTimers(delta)

    this.sys.player.updatePlayerMovement(delta)
    this.sys.player.resolveCollisions()
    this.sys.weapon.updateWeapon(delta)
    this.sys.fx.updateEffects(delta)
    this.sys.pickups.updatePickups(delta)

    this.sys.weapon.tickFireReload(delta)

    if (this.ctx.multiplayer) {
      this.sys.multiplayer.updateMultiplayer(delta)
    } else if (this.ctx.survivors) {
      this.sys.pve.updateEnemies(delta, elapsed)
      this.sys.projectiles.updateProjectiles(delta)
      this.sys.survivors.updateSurvivors(delta)
    } else if (this.ctx.sandbox) {
      this.sys.pve.updateEnemies(delta, elapsed)
      this.sys.projectiles.updateProjectiles(delta)
    } else {
      this.sys.pve.updateEnemies(delta, elapsed)
      this.sys.projectiles.updateProjectiles(delta)
      this.sys.pve.updateWaves(delta)
    }
  }

  // ------------------------------------------------------ public API (App.tsx)

  requestLock() {
    this.sys.input.requestLock()
  }

  startCampaign(startMapId?: string) {
    this.ctx.sandbox = false
    this.sys.pve.startCampaign(startMapId)
  }

  startSurvivors(classId?: SurvivorClassId) {
    this.ctx.sandbox = false
    this.sys.survivors.startSurvivors(classId)
  }

  setSurvivorClass(classId: SurvivorClassId) {
    this.sys.survivors.setSurvivorClass(classId)
  }

  startSandbox(mapId: string = this.ctx.currentMap?.id ?? DEFAULT_MAP_ID) {
    this.sys.multiplayer.leaveMultiplayer(false)
    this.ctx.sandbox = true
    this.ctx.survivors = false
    this.sys.survivors.recomputeStats()
    this.sys.arena.buildArena(getMap(mapId))
    this.sys.player.resetPlayer()
    this.sys.fx.clearTransientFx()
    this.sys.survivors.clearSurvivorsEntities()
    this.sys.pve.startWaveSystem()
    this.unlockSandboxArsenal(STARTING_WEAPON)
    this.ctx.status = 'pointerlock-needed'
    this.sys.hud.announce('SANDBOX')
    this.sys.hud.emit()
  }

  setSandboxWeapon(id: WeaponId) {
    if (!this.ctx.sandbox) return
    this.unlockSandboxArsenal(id)
    this.sys.hud.showToast(`LAB WEAPON: ${WEAPONS[id].name.toUpperCase()}`)
    this.sys.hud.emit()
  }

  refillSandboxAmmo() {
    if (!this.ctx.sandbox) return
    const spec = WEAPONS[this.ctx.activeWeapon]
    this.ctx.ammo = spec.magazineSize
    this.ctx.reserve = spec.reserveCap
    this.ctx.reloading = false
    this.ctx.reloadTimer = 0
    this.sys.hud.showToast('LAB AMMO REFILLED')
    this.sys.hud.emit()
  }

  fireSandboxWeapon() {
    if (!this.ctx.sandbox) return
    if (this.ctx.ammo <= 0) this.refillSandboxAmmo()
    this.sys.weapon.shoot()
  }

  spawnSandboxEnemy(kind: SandboxEnemyKind, count = 1) {
    if (!this.ctx.sandbox) return
    const n = kind === 'boss' ? 1 : Math.max(1, Math.min(12, Math.floor(count)))
    const player = this.ctx.body.position
    const fwd = this.ctx.camera.getWorldDirection(new THREE.Vector3())
    fwd.y = 0
    if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1)
    fwd.normalize()
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x)
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)))

    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const offset = (col - (cols - 1) / 2) * 2.3
      const distance = kind === 'boss' ? 18 : 8 + row * 2.1
      const x = player.x + fwd.x * distance + right.x * offset
      const z = player.z + fwd.z * distance + right.z * offset
      const enemy = this.sys.pve.getFreeEnemy()

      if (kind === 'boss') {
        enemy.spawnAt(x, z, {
          maxHealth: BOSS_HEALTH,
          isBoss: true,
          ranged: true,
          scale: BOSS_SCALE,
          speed: BOSS_SPEED,
          color: BOSS_COLOR,
          attackDamage: BOSS_ATTACK_DAMAGE,
          attackInterval: BOSS_ATTACK_INTERVAL,
          attackRange: BOSS_ATTACK_RANGE,
          projectileDamage: BOSS_PROJECTILE_DAMAGE,
          projectileSpeed: BOSS_PROJECTILE_SPEED,
        })
        this.sys.pve.bossActive = true
        this.sys.pve.bossEnemy = enemy
        this.sys.pve.bossMaxHealth = BOSS_HEALTH
      } else {
        const arch = kind === 'flying'
          ? ENEMY_ARCHETYPES.flier
          : kind === 'ranged'
            ? ENEMY_ARCHETYPES.shooter
            : ENEMY_ARCHETYPES.grunt
        enemy.spawnAt(x, z, {
          maxHealth: ENEMY_MAX_HEALTH * arch.hpMul,
          speed: ENEMY_SPEED_MIN * arch.speedMul,
          color: arch.color,
          archetype: arch.id,
          scale: arch.scale,
          ranged: arch.ranged,
          flying: arch.flying,
          hoverHeight: arch.hoverHeight,
          attackDamage: arch.attackDamage ?? ENEMY_ATTACK_DAMAGE,
          attackInterval: ENEMY_ATTACK_INTERVAL,
          attackRange: ENEMY_ATTACK_RANGE,
          projectileDamage: arch.projectileDamage ?? ENEMY_PROJECTILE_DAMAGE,
          projectileSpeed: ENEMY_PROJECTILE_SPEED,
        })
      }
      this.ctx.bounds.clampXZ(enemy.position, 1.5)
      this.sys.player.pushOutOfObstacles(enemy.position, enemy.radius)
    }
    this.sys.hud.showToast(`LAB SPAWN: ${kind.toUpperCase()} ×${n}`)
    this.sys.hud.emit()
  }

  damageSandboxEnemies(amount: number, headshot = false, all = false) {
    if (!this.ctx.sandbox) return
    const alive = this.ctx.enemies.filter((enemy) => enemy.alive)
    if (!alive.length) return
    const player = this.ctx.body.position
    alive.sort((a, b) => a.position.distanceToSquared(player) - b.position.distanceToSquared(player))
    const targets = all ? alive : [alive[0]]
    for (const enemy of targets) {
      const dx = enemy.position.x - player.x
      const dz = enemy.position.z - player.z
      const len = Math.hypot(dx, dz) || 1
      const dmg = amount < 0 ? enemy.health + 1 : amount
      const res = enemy.takeDamage(dmg, headshot, 6, dx / len, dz / len)
      if (!res.blocked) {
        this.sys.hud.addDamageNumber(enemy.position.clone().setY(headshot ? 1.85 : 1.35), dmg, headshot ? 'head' : 'normal')
        this.sys.fx.spawnImpactSpark(enemy.position.clone().setY(headshot ? 1.8 : 1.25), headshot ? 0xffffff : 0xffd166)
      }
      if (res.died) {
        if (headshot) this.ctx.headshots++
        this.sys.pve.onEnemyDeath(enemy, headshot)
      } else if (headshot) {
        this.ctx.headshots++
        this.sys.hud.headshotSeq++
      } else {
        this.sys.hud.hitMarkerSeq++
      }
    }
    this.sys.hud.emit()
  }

  clearSandboxActors() {
    if (!this.ctx.sandbox) return
    for (const enemy of this.ctx.enemies) enemy.kill()
    this.sys.fx.clearTransientFx()
    this.sys.pve.bossActive = false
    this.sys.pve.bossEnemy = null
    this.sys.hud.showToast('LAB CLEARED')
    this.sys.hud.emit()
  }

  spawnSandboxPickup(kind: PickupKind) {
    if (!this.ctx.sandbox) return
    const pos = this.pointInFront(5)
    this.sys.pickups.spawnPickup(kind, pos.x, pos.z)
    const last = this.sys.pickups.pickups[this.sys.pickups.pickups.length - 1]
    if (last) last.age = Math.min(last.age, PICKUP_TTL - 3)
    this.sys.hud.showToast(`LAB PICKUP: ${kind.toUpperCase()}`)
    this.sys.hud.emit()
  }

  startMultiplayer(room: string, name: string, avatar: PlayerAvatarId = 'ranger') {
    this.ctx.sandbox = false
    this.sys.multiplayer.startMultiplayer(room, name, avatar)
  }

  leaveMultiplayer(toMenu = true) {
    this.sys.multiplayer.leaveMultiplayer(toMenu)
  }

  setShopUpgrades(tiers: Record<string, number>) {
    this.sys.survivors.setShopUpgrades(tiers)
  }

  pickUpgrade(id: string) {
    this.sys.survivors.pickUpgrade(id)
  }

  rerollUpgrades() {
    this.sys.survivors.reroll()
  }

  banishUpgrade(id: string) {
    this.sys.survivors.banish(id)
  }

  restart() {
    this.sys.gameOver.restart()
  }

  returnToMenu() {
    this.ctx.sandbox = false
    this.sys.gameOver.returnToMenu()
  }

  private unlockSandboxArsenal(active: WeaponId) {
    for (const id of WEAPON_ORDER) {
      this.ctx.unlocked.add(id)
      this.ctx.weaponMag[id] = WEAPONS[id].magazineSize
      this.ctx.weaponReserve[id] = WEAPONS[id].reserveCap
    }
    this.ctx.activeWeapon = active
    this.ctx.ammo = WEAPONS[active].magazineSize
    this.ctx.reserve = WEAPONS[active].reserveCap
    this.ctx.reloading = false
    this.ctx.reloadTimer = 0
    this.ctx.fireCooldown = 0
    this.sys.weapon.applyWeaponModel(active)
  }

  private pointInFront(distance: number): THREE.Vector3 {
    const origin = this.ctx.body.position
    const fwd = this.ctx.camera.getWorldDirection(new THREE.Vector3())
    fwd.y = 0
    if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1)
    fwd.normalize()
    const pos = new THREE.Vector3(origin.x + fwd.x * distance, 0, origin.z + fwd.z * distance)
    this.ctx.bounds.clampXZ(pos, 1.5)
    return pos
  }

  dispose() {
    this.ctx.disposed = true
    cancelAnimationFrame(this.ctx.raf)

    this.sys.multiplayer.leaveMultiplayer(false)
    this.sys.input.removeListeners()

    this.ctx.rig.dispose()

    for (const enemy of this.ctx.enemies) enemy.dispose()
    this.ctx.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })

    this.ctx.renderer.dispose()
    if (this.ctx.renderer.domElement.parentElement === this.ctx.container) {
      this.ctx.container.removeChild(this.ctx.renderer.domElement)
    }
  }
}
