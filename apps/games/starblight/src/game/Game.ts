import { COLORS, CONSTANTS, WORLD, type EnemyType } from './constants'
import {
  ALL_UPGRADES,
  computeStats,
  defOf,
  maxLevelOf,
  xpForLevel,
  type Stats,
  type UpgradeId,
} from './upgrades'
import type { DraftCard, Enemy, GamePhase, HudState } from './types'
import { RenderSystem } from '../systems/RenderSystem'
import { InputSystem } from '../systems/InputSystem'
import { EntitySystem } from '../systems/EntitySystem'
import { WeaponSystem } from '../systems/WeaponSystem'
import { HudSystem } from '../systems/HudSystem'

const TAU = Math.PI * 2

// Survivors orchestrator: owns run-state (XP / level / integrity / draft), the
// time-driven director, the boss state machine, collisions, and the rAF loop.
export class Game {
  private render: RenderSystem
  private input: InputSystem
  private entities: EntitySystem
  private weapons: WeaponSystem
  private hud: HudSystem

  // --- run-state ---------------------------------------------------------
  private phase: GamePhase = 'title'
  private clock = 0
  private level = 1
  private currentXP = 0
  private pendingLevels = 0
  private integrity: number = CONSTANTS.player.startIntegrity
  private kills = 0
  private salvage = 0 // total gem value collected (the "salvage" readout)
  private invuln = 0
  private vacuum = false // queued salvage-pulse (vacuum all gems next frame)

  private levels = new Map<UpgradeId, number>()
  private stats: Stats = computeStats(new Map(), CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity)
  private draft: DraftCard[] | null = null

  // --- director ----------------------------------------------------------
  private spawnT = 0
  private eliteT = 0

  // --- boss --------------------------------------------------------------
  private boss: Enemy | null = null
  private bossTriggered = false
  private bossBurstT = 0
  private bossDashT = 0
  private bossSpiralT = 0
  private bossSummonT = 0
  private bossOrbit = 0
  private bossDashState: 'none' | 'telegraph' | 'charge' = 'none'
  private bossDashTime = 0
  private bossDashX = 0
  private bossDashY = 0

  private raf = 0
  private prev = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas)
    this.input = new InputSystem(canvas)
    this.entities = new EntitySystem(this.render)
    this.weapons = new WeaponSystem(this.render, this.entities)
    this.weapons.damageEnemy = (e, dmg, allowCrit) => this.damageEnemy(e, dmg, allowCrit)
    this.hud = new HudSystem(
      () => this.startRun(),
      (id) => this.pickById(id),
      () => this.pauseRun(),
      () => this.resumeRun(),
      () => this.startRun(),
      () => this.returnToTitle(),
    )
  }

  start() {
    this.input.bind()
    this.entities.buildShip()
    this.emitHud()
    this.prev = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.input.dispose()
    this.weapons.dispose()
    this.entities.dispose()
    this.hud.dispose()
    this.render.dispose()
  }

  // --- run lifecycle -----------------------------------------------------

  private startRun() {
    this.phase = 'playing'
    this.clock = 0
    this.level = 1
    this.currentXP = 0
    this.pendingLevels = 0
    this.kills = 0
    this.salvage = 0
    this.invuln = 0
    this.vacuum = false
    this.draft = null

    this.levels = new Map<UpgradeId, number>([['seeker', 1]]) // start armed
    this.recomputeStats()
    this.integrity = this.stats.maxIntegrity

    this.entities.clearEnemies()
    this.entities.clearProjectiles()
    this.entities.clearGems()
    this.entities.clearParticles()
    this.entities.resetShip()
    this.weapons.reset()
    this.weapons.setLoadout(this.levels, this.stats)
    this.render.resetFocus(0, 0)

    this.boss = null
    this.bossTriggered = false
    this.spawnT = 0.6
    this.eliteT = CONSTANTS.director.eliteEvery

    this.emitHud()
  }

  private pauseRun() {
    if (this.phase !== 'playing') return
    this.phase = 'paused'
    this.emitHud()
  }

  private resumeRun() {
    if (this.phase !== 'paused') return
    this.phase = 'playing'
    this.emitHud()
  }

  private returnToTitle() {
    this.phase = 'title'
    this.clock = 0
    this.level = 1
    this.currentXP = 0
    this.pendingLevels = 0
    this.kills = 0
    this.salvage = 0
    this.invuln = 0
    this.vacuum = false
    this.draft = null

    this.levels = new Map()
    this.recomputeStats()
    this.integrity = this.stats.maxIntegrity

    this.entities.clearEnemies()
    this.entities.clearProjectiles()
    this.entities.clearGems()
    this.entities.clearParticles()
    this.entities.resetShip()
    this.weapons.reset()
    this.render.resetFocus(0, 0)

    this.boss = null
    this.bossTriggered = false
    this.spawnT = 0
    this.eliteT = 0

    this.emitHud()
  }

  private recomputeStats() {
    this.stats = computeStats(this.levels, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity)
    if (this.integrity > this.stats.maxIntegrity) this.integrity = this.stats.maxIntegrity
    this.weapons.setLoadout(this.levels, this.stats)
  }

  // --- main loop ---------------------------------------------------------

  private loop = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)

    const dt = Math.min((now - this.prev) / 1000, CONSTANTS.maxDelta)
    this.prev = now

    if (this.input.consumePause()) {
      if (this.phase === 'playing') this.pauseRun()
      else if (this.phase === 'paused') this.resumeRun()
    }

    if (this.phase === 'playing') this.simulate(dt)

    // Camera follows the ship (also keeps the menu backdrop alive).
    this.render.update(dt, this.entities.ship.position.x, this.entities.ship.position.y)
    this.render.render()
    this.emitHud()

    // Menu confirm starts / restarts, or resumes from pause.
    if (this.phase === 'paused' && this.input.consumeConfirm()) {
      this.resumeRun()
    } else if ((this.phase === 'title' || this.phase === 'gameover' || this.phase === 'victory') && this.input.consumeConfirm()) {
      this.startRun()
    } else {
      this.input.consumeConfirm()
    }
    // Drain a queued keyboard card pick while drafting.
    if (this.phase === 'levelup') {
      const c = this.input.consumeCard()
      if (c >= 0 && this.draft && c < this.draft.length) this.pickById(this.draft[c].id)
    } else {
      this.input.consumeCard()
    }
  }

  private simulate(dt: number) {
    this.clock += dt
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt)

    // 1. flight
    const aim = this.render.screenToWorld(this.input.ndcX, this.input.ndcY)
    const key = this.input.keyAxis()
    this.entities.moveShip(aim.x, aim.y, key.x, key.y, dt, this.stats.moveMul, this.stats.accelMul)

    // 2. director + 3. enemy AI
    this.director(dt)
    this.entities.updateEnemies(dt, this.clock)
    if (this.boss) this.updateBoss(dt)

    // 4. weapons fire / deal damage
    this.weapons.update(dt, this.clock)

    // 5. player bolts vs enemies
    this.entities.updateBullets(dt)
    this.resolveBolts()

    // 6. enemy globs vs ship + 7. contact
    this.entities.updateEnemyBullets(dt)
    this.resolveEnemyBullets()
    this.resolveContact()

    // 8. salvage magnet + XP
    const raw = this.entities.updateGems(dt, this.stats.magnetRadius, this.vacuum)
    this.vacuum = false
    if (raw > 0) this.gainXp(raw)

    this.entities.updateParticles(dt)
    this.entities.sweepEnemies()

    if (this.integrity <= 0 && this.phase === 'playing') {
      this.integrity = 0
      this.phase = 'gameover'
      this.emitHud()
    }
  }

  // --- director ----------------------------------------------------------

  private director(dt: number) {
    const d = CONSTANTS.director
    // Boss trigger.
    if (!this.bossTriggered && this.clock >= CONSTANTS.boss.spawnAt) {
      this.spawnBoss()
    }

    // Alive-cap ramps over the run.
    const ramp = Math.min(1, this.clock / d.aliveRampTime)
    const aliveCap = d.aliveMin + (d.aliveMax - d.aliveMin) * ramp
    const aliveCount = this.boss ? this.entities.enemies.length - 1 : this.entities.enemies.length

    this.spawnT -= dt
    if (this.spawnT <= 0 && aliveCount < aliveCap) {
      let interval = Math.max(d.spawnFloor, d.spawnBase - this.clock * d.spawnSlope)
      if (this.boss) interval *= 3 // the fight reads as a duel
      this.spawnT = interval
      const batch = Math.min(d.batchCap, d.batchBase + Math.floor(this.clock / d.batchPer))
      // Respect remaining headroom each pick so a swarmling cluster can't blow
      // past the alive-cap in a single tick (the cap protects the framerate).
      let headroom = Math.floor(aliveCap) - aliveCount
      for (let i = 0; i < batch && headroom > 0; i++) {
        headroom -= this.spawnFromRing(this.pickType(), headroom)
      }
    }

    this.eliteT -= dt
    if (!this.boss && this.eliteT <= 0) {
      this.eliteT = d.eliteEvery
      const p = this.ringPoint()
      this.entities.pop(p.x, p.y, COLORS.toxicHot, 16) // spawn flare
      this.render.addShake(0.25)
      this.spawnAt('elite', p.x, p.y)
    }
  }

  private pickType(): EnemyType {
    const c = this.clock
    const weights: [EnemyType, number][] = [
      ['grunt', 1],
      ['swarmling', c > 20 ? 0.8 : 0.1],
      ['weaver', c > 30 ? 0.6 : 0],
      ['spitter', c > 45 ? 0.5 : 0],
    ]
    let total = 0
    for (const [, w] of weights) total += w
    let r = Math.random() * total
    for (const [type, w] of weights) {
      r -= w
      if (r <= 0) return type
    }
    return 'grunt'
  }

  private ringPoint(): { x: number; y: number } {
    const a = Math.random() * TAU
    const r = this.render.viewHalfDiag + CONSTANTS.director.ringPad
    const lim = WORLD.halfW - 2
    const x = clamp(this.entities.ship.position.x + Math.cos(a) * r, -lim, lim)
    const y = clamp(this.entities.ship.position.y + Math.sin(a) * r, -lim, lim)
    return { x, y }
  }

  /** Spawns one pick (a swarmling cluster or a single enemy), clamped to the
   *  given headroom. Returns how many enemies it actually spawned. */
  private spawnFromRing(type: EnemyType, headroom: number): number {
    const p = this.ringPoint()
    if (type === 'swarmling') {
      const n = Math.min(headroom, 5 + Math.floor(Math.random() * 4))
      for (let i = 0; i < n; i++) {
        this.spawnAt('swarmling', p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6)
      }
      return n
    }
    this.spawnAt(type, p.x, p.y)
    return 1
  }

  private spawnAt(type: EnemyType, x: number, y: number) {
    const d = CONSTANTS.director
    const hpMul = 1 + this.clock * d.hpSlope
    const speedMul = Math.min(d.speedCap, 1 + this.clock * d.speedSlope)
    this.entities.spawnEnemy(type, x, y, hpMul, speedMul)
  }

  // --- damage + kills ----------------------------------------------------

  private damageEnemy(e: Enemy, baseDmg: number, allowCrit = true) {
    if (e.dead) return
    const crit = allowCrit && this.stats.critChance > 0 && Math.random() < this.stats.critChance
    const dmg = baseDmg * this.stats.damageMul * (crit ? 2 : 1)
    e.health -= dmg
    this.entities.hitFlash(e)
    if (e.health <= 0) this.onKill(e)
  }

  private onKill(e: Enemy) {
    if (e.boss) {
      this.bossDefeated(e)
      return
    }
    this.kills++
    const x = e.mesh.position.x
    const y = e.mesh.position.y
    if (e.type === 'elite') {
      this.entities.spawnGem(x, y, 25)
      const shards = 4 + Math.floor(Math.random() * 3)
      for (let i = 0; i < shards; i++) {
        this.entities.spawnGem(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 3)
      }
      this.entities.pop(x, y, COLORS.bone, 18)
      this.entities.pop(x, y, COLORS.hellfire, 12)
      this.render.addShake(CONSTANTS.fx.shake.eliteKill)
    } else {
      this.entities.spawnGem(x, y, e.gemValue)
      const ichor = e.type === 'spitter' || e.type === 'weaver' ? COLORS.toxic : COLORS.hellfire
      this.entities.pop(x, y, ichor, 8)
      this.render.addShake(CONSTANTS.fx.shake.gruntKill)
    }
    this.entities.killEnemy(e)
  }

  // --- collisions --------------------------------------------------------

  private resolveBolts() {
    for (const b of this.entities.bullets) {
      if (b.dead) continue
      for (const e of this.entities.enemies) {
        if (e.dead || b.hit.includes(e)) continue
        const dx = b.mesh.position.x - e.mesh.position.x
        const dy = b.mesh.position.y - e.mesh.position.y
        if (dx * dx + dy * dy < (e.radius + 0.6) ** 2) {
          b.hit.push(e)
          this.damageEnemy(e, b.damage)
          if (b.pierce <= 0) {
            b.dead = true
            break
          }
          b.pierce--
        }
      }
    }
  }

  private resolveEnemyBullets() {
    if (this.invuln > 0) return
    const sx = this.entities.ship.position.x
    const sy = this.entities.ship.position.y
    const rr = (CONSTANTS.player.width * 0.5 + 0.5) ** 2
    for (const b of this.entities.enemyBullets) {
      if (b.dead) continue
      const dx = b.mesh.position.x - sx
      const dy = b.mesh.position.y - sy
      if (dx * dx + dy * dy < rr) {
        b.dead = true
        this.hitPlayer(b.damage)
        return
      }
    }
  }

  private resolveContact() {
    if (this.invuln > 0) return
    const sx = this.entities.ship.position.x
    const sy = this.entities.ship.position.y
    const shipR = CONSTANTS.player.width * 0.5
    for (const e of this.entities.enemies) {
      if (e.dead) continue
      const dx = e.mesh.position.x - sx
      const dy = e.mesh.position.y - sy
      const rr = e.radius + shipR
      if (dx * dx + dy * dy < rr * rr) {
        this.hitPlayer(e.contactDmg)
        return
      }
    }
  }

  private hitPlayer(dmg: number) {
    this.integrity -= dmg
    this.invuln = CONSTANTS.player.invulnTime
    this.entities.pop(this.entities.ship.position.x, this.entities.ship.position.y, COLORS.blood, 18)
    this.render.addShake(CONSTANTS.fx.shake.playerHit)
  }

  // --- XP + draft --------------------------------------------------------

  private gainXp(raw: number) {
    this.salvage += raw
    this.currentXP += raw * this.stats.xpGainMul
    let leveled = false
    while (this.currentXP >= xpForLevel(this.level)) {
      this.currentXP -= xpForLevel(this.level)
      this.level++
      this.pendingLevels++
      leveled = true
    }
    if (leveled && this.phase === 'playing') this.triggerLevelUp()
  }

  private triggerLevelUp() {
    this.phase = 'levelup'
    this.vacuum = true // salvage pulse: vacuum the field
    this.rollDraft()
    this.emitHud()
  }

  private rollDraft() {
    const eligible = ALL_UPGRADES.filter((u) => (this.levels.get(u.id) ?? 0) < maxLevelOf(u.id))
    if (eligible.length === 0) {
      // Everything maxed — nothing to draft; just drain the queue.
      this.pendingLevels = Math.max(0, this.pendingLevels - 1)
      this.draft = null
      this.phase = this.pendingLevels > 0 ? 'levelup' : 'playing'
      if (this.phase === 'levelup') this.rollDraft()
      return
    }
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
    }
    this.draft = eligible.slice(0, 3).map((u) => {
      const lvl = this.levels.get(u.id) ?? 0
      return {
        id: u.id,
        name: u.name,
        desc: u.desc,
        icon: u.icon,
        kind: u.kind,
        level: lvl,
        max: maxLevelOf(u.id),
      }
    })
  }

  private pickById(id: UpgradeId) {
    if (this.phase !== 'levelup' || !this.draft) return
    if (!this.draft.some((c) => c.id === id)) return
    const prev = this.levels.get(id) ?? 0
    this.levels.set(id, prev + 1)
    this.recomputeStats()
    if (id === 'hull') this.integrity = this.stats.maxIntegrity // full repair
    this.pendingLevels = Math.max(0, this.pendingLevels - 1)
    if (this.pendingLevels > 0) {
      this.rollDraft()
      this.emitHud()
    } else {
      this.draft = null
      this.phase = 'playing'
      this.emitHud()
    }
  }

  // --- boss --------------------------------------------------------------

  private spawnBoss() {
    this.bossTriggered = true
    const b = CONSTANTS.boss
    const p = this.ringPoint()
    this.boss = this.entities.spawnBoss(p.x, p.y, b.baseHP, b.contactDmg, 5)
    this.bossBurstT = 1.5
    this.bossDashT = b.dashEvery
    this.bossSpiralT = 0
    this.bossSummonT = b.summonEvery
    this.bossOrbit = Math.random() * TAU
    this.bossDashState = 'none'
    this.render.addShake(CONSTANTS.fx.shake.bossSpawn)
    this.entities.pop(p.x, p.y, COLORS.toxicHot, 40)
  }

  private bossPhase(): 1 | 2 | 3 {
    if (!this.boss) return 1
    const pct = this.boss.health / this.boss.maxHealth
    if (pct > CONSTANTS.boss.phase2Pct) return 1
    if (pct > CONSTANTS.boss.phase3Pct) return 2
    return 3
  }

  private updateBoss(dt: number) {
    const boss = this.boss
    if (!boss || boss.dead) return
    const b = CONSTANTS.boss
    const sx = this.entities.ship.position.x
    const sy = this.entities.ship.position.y
    const phase = this.bossPhase()

    // Movement: orbit the ship, unless dashing.
    if (this.bossDashState === 'charge') {
      boss.mesh.position.x += this.bossDashX * dt
      boss.mesh.position.y += this.bossDashY * dt
      this.bossDashTime -= dt
      if (this.bossDashTime <= 0) this.bossDashState = 'none'
    } else {
      this.bossOrbit += b.orbitSpeed * dt
      const tx = sx + Math.cos(this.bossOrbit) * b.orbitR
      const ty = sy + Math.sin(this.bossOrbit) * b.orbitR
      boss.mesh.position.x += (tx - boss.mesh.position.x) * Math.min(1, dt * 1.4)
      boss.mesh.position.y += (ty - boss.mesh.position.y) * Math.min(1, dt * 1.4)
    }
    const bx = boss.mesh.position.x
    const by = boss.mesh.position.y

    // Radial spore bursts (all phases, faster later).
    this.bossBurstT -= dt
    if (this.bossBurstT <= 0) {
      this.bossBurstT = b.burstEvery * (phase === 1 ? 1 : phase === 2 ? 0.75 : 0.55)
      boss.flash = 0.12
      const off = Math.random() * TAU
      for (let i = 0; i < b.burstCount; i++) {
        const a = off + (i / b.burstCount) * TAU
        this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg)
      }
    }

    // Summons.
    this.bossSummonT -= dt
    if (this.bossSummonT <= 0) {
      this.bossSummonT = b.summonEvery
      const type: EnemyType = phase === 3 ? 'spitter' : phase === 2 ? 'swarmling' : 'grunt'
      for (let i = 0; i < (phase === 1 ? 2 : 3); i++) {
        this.spawnAt(type, bx + (Math.random() - 0.5) * 8, by + (Math.random() - 0.5) * 8)
      }
    }

    // Charge-dash (all phases; rarer in phase 1). The lunge is the boss's
    // contact threat — it travels just past the ship so it crosses the hull.
    this.bossDashT -= dt
    if (this.bossDashState === 'none' && this.bossDashT <= 0) {
      this.bossDashState = 'telegraph'
      this.bossDashTime = b.dashTelegraph
      boss.flash = b.dashTelegraph
    } else if (this.bossDashState === 'telegraph') {
      this.bossDashTime -= dt
      if (this.bossDashTime <= 0) {
        const ddx = sx - bx
        const ddy = sy - by
        const dist = Math.hypot(ddx, ddy) || 1
        this.bossDashX = (ddx / dist) * b.dashSpeed
        this.bossDashY = (ddy / dist) * b.dashSpeed
        this.bossDashState = 'charge'
        // Travel just past the ship so the lunge actually crosses the hull.
        this.bossDashTime = Math.min(0.8, (dist + 4) / b.dashSpeed)
        this.bossDashT = b.dashEvery * (phase === 1 ? 1.6 : 1)
        this.render.addShake(CONSTANTS.fx.shake.bossCharge)
      }
    }

    // Phase 3: rotating spiral of globs.
    if (phase === 3) {
      this.bossSpiralT -= dt
      if (this.bossSpiralT <= 0) {
        this.bossSpiralT = b.spiralEvery
        this.bossOrbit += 0.4
        for (let k = 0; k < b.spiralCount; k++) {
          const a = this.bossOrbit + (k / b.spiralCount) * TAU
          this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg)
        }
      }
    }
  }

  private bossDefeated(e: Enemy) {
    const x = e.mesh.position.x
    const y = e.mesh.position.y
    this.entities.killEnemy(e)
    this.boss = null
    this.kills++
    // Triumphant gem shower + storm.
    for (let i = 0; i < 10; i++) {
      this.entities.spawnGem(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 25)
    }
    this.entities.pop(x, y, COLORS.hellfire, 40)
    this.entities.pop(x, y, COLORS.bone, 30)
    this.entities.pop(x, y, COLORS.bloodHot, 30)
    this.render.addShake(CONSTANTS.fx.shake.bossDeath)
    this.vacuum = true
    this.phase = 'victory'
    this.emitHud()
  }

  // --- HUD bridge --------------------------------------------------------

  private emitHud() {
    const build = this.buildChips()
    const need = xpForLevel(this.level)
    const state: HudState = {
      phase: this.phase,
      level: this.level,
      xp01: need > 0 ? Math.min(1, this.currentXP / need) : 0,
      timeSec: this.clock,
      integrity: Math.max(0, Math.round(this.integrity)),
      maxIntegrity: Math.round(this.stats.maxIntegrity),
      gems: Math.round(this.salvage),
      kills: this.kills,
      build,
      draft: this.draft,
      bossHp01: this.boss && !this.boss.dead ? Math.max(0, this.boss.health / this.boss.maxHealth) : null,
      lowIntegrity: this.integrity > 0 && this.integrity < this.stats.maxIntegrity * 0.25,
    }
    this.hud.update(state)
  }

  private buildChips() {
    const out: HudState['build'] = []
    for (const [id, level] of this.levels) {
      if (level <= 0) continue
      const def = defOf(id)
      out.push({
        id,
        icon: def.icon,
        name: def.name,
        level,
        max: maxLevelOf(id),
        kind: def.kind,
      })
    }
    // Weapons first, then passives.
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'weapon' ? -1 : 1))
    return out
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
