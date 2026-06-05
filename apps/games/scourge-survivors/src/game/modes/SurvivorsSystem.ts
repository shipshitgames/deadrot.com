import * as THREE from 'three'
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'
import { audio } from '../../audio/AudioEngine'
import { Enemy } from '../entities/Enemy'
import { XP_BLOOD_SCALE, XP_BLOOD_TEXTURE } from '../spriteAssets'
import { WEAPONS } from '../constants'
import { DEFAULT_MAP_ID, getMap } from '../data/maps'
import { pickWeightedEnemyArchetype } from '../data/enemies'
import {
  AMP_PER_TIER,
  BANISHES_PER_RUN,
  BOLT_DMG,
  BOLT_SPEED,
  BOLT_TTL,
  NOVA_DMG,
  NOVA_INTERVAL,
  NOVA_RADIUS,
  ORBIT_DMG,
  ORBIT_HIT_CD,
  ORBIT_HIT_RADIUS,
  ORBIT_RADIUS,
  ORBIT_SPEED,
  REROLLS_PER_LEVEL,
  SURV_BASE_MAGNET,
  SURV_ELITE_INTERVAL,
  SURV_ENEMY_BASE_HP,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_CHAPTERS,
  SURVIVOR_RUN_GOAL_TIME,
  SURV_SPAWN_CAP,
  SURV_SPAWN_MIN,
  SURV_SPAWN_START,
  SURV_SWELL_CAP,
  SURV_SWELL_COUNT,
  SURV_SWELL_INTERVAL,
  SURV_XP_ELITE_VALUE,
  SURV_XP_GEM_VALUE,
  UPGRADES,
  UPGRADE_BY_ID,
  WEAPON_UPGRADE_IDS,
  availableEvolutionChoice,
  survivorBuildList,
  survivorChapterAt,
  survivorChapterStart,
  xpForLevel,
  type SurvArchetype,
  type SurvivorClassId,
  type UpgradeId,
  type WeaponUpgradeId,
} from '../data/survivors'
import type { BuildEntry, UpgradeChoice } from '../types'

const DEFENSIVE_UPGRADES: UpgradeId[] = ['maxhp', 'regen', 'armor', 'ward', 'spikes', 'bloodtap', 'bastion', 'dodge', 'grace']

export class SurvivorsSystem {
  level = 1
  xp = 0
  xpToNext = xpForLevel(1)
  pendingLevels = 0
  choices: UpgradeChoice[] = []
  upgradeLevels: Partial<Record<UpgradeId, number>> = {}
  orbitLevel = 0
  boltLevel = 0
  novaLevel = 0
  // auto-weapon runtime
  orbitGroup!: THREE.Group
  orbitOrbs: THREE.Mesh[] = []
  orbitAngle = 0
  orbitCd = new WeakMap<Enemy, number>()
  bolts: { mesh: THREE.Mesh; vel: THREE.Vector3; dmg: number; age: number; pierce: number }[] = []
  boltTimer = 0
  novas: { mesh: THREE.Mesh; age: number; ttl: number; hit: Set<Enemy>; dmg: number; maxR: number }[] = []
  novaTimer = NOVA_INTERVAL
  survSpawnTimer = 0
  survClock = 0
  eliteTimer = SURV_ELITE_INTERVAL
  swellTimer = SURV_SWELL_INTERVAL // next breach-surge horde swell
  xpGems: { sprite: THREE.Sprite; value: number; age: number }[] = []
  enemyXp = new WeakMap<Enemy, number>()
  shopTiers: Record<string, number> = {} // permanent meta-upgrades

  // --- draft agency + build identity ---
  selectedClass: SurvivorClassId = 'ranger'
  rerolls = 0 // free re-rolls remaining for the open draft
  banishes = 0 // banishes remaining this run
  banished = new Set<UpgradeId>() // upgrades removed from this run's pool
  evolved: Record<WeaponUpgradeId, boolean> = { orbit: false, bolt: false, nova: false }
  statAmp = 1 // 'amp' (Overcharge) auto-weapon damage multiplier
  bastionTimer = 0

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  init() {
    this.orbitGroup = new THREE.Group()
    this.orbitGroup.visible = false
    this.ctx.scene.add(this.orbitGroup)
  }

  startSurvivors(classId: SurvivorClassId = this.selectedClass) {
    this.sys.multiplayer.leaveMultiplayer(false)
    this.selectedClass = SURVIVOR_CLASSES[classId] ? classId : 'ranger'
    this.ctx.survivorClassId = this.selectedClass
    this.ctx.survivors = true
    this.ctx.campaignStage = 0
    this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID))
    this.sys.player.resetPlayer(SURVIVOR_CLASSES[this.selectedClass].startingWeapon)
    this.initSurvivorsRun()
    this.ctx.status = 'pointerlock-needed'
    this.sys.hud.emit()
    this.sys.input.requestLock()
  }

  initSurvivorsRun() {
    this.level = 1
    this.xp = 0
    this.xpToNext = xpForLevel(1)
    this.pendingLevels = 0
    this.choices = []
    this.upgradeLevels = {}
    this.banishes = BANISHES_PER_RUN
    this.banished.clear()
    this.evolved = { orbit: false, bolt: false, nova: false }
    this.rerolls = 0
    this.bastionTimer = 0
    this.ctx.survivorChapter = 0
    this.ctx.survivorTotalChapters = SURVIVOR_RUN_CHAPTERS.length
    this.ctx.survivorGoalTime = SURVIVOR_RUN_GOAL_TIME
    const cls = SURVIVOR_CLASSES[this.ctx.survivorClassId]
    for (const [id, level] of Object.entries(cls.startingUpgrades ?? {}) as [UpgradeId, number][]) {
      this.upgradeLevels[id] = Math.max(this.upgradeLevels[id] ?? 0, level)
    }
    if ((this.shopTiers['arsenal'] ?? 0) > 0) this.upgradeLevels.orbit = Math.max(this.upgradeLevels.orbit ?? 0, 1) // Arsenal perk
    if ((this.shopTiers['munitions'] ?? 0) > 0) this.upgradeLevels.bolt = Math.max(this.upgradeLevels.bolt ?? 0, 1) // Munitions perk
    if ((this.shopTiers['pulsar'] ?? 0) > 0) this.upgradeLevels.nova = Math.max(this.upgradeLevels.nova ?? 0, 1) // Pulsar perk
    this.survSpawnTimer = 0.25
    this.survClock = 0
    this.eliteTimer = this.currentChapter().eliteInterval
    this.swellTimer = this.currentChapter().swellInterval
    this.boltTimer = 0
    this.novaTimer = NOVA_INTERVAL
    this.ctx.damageGraceTimer = 0
    for (const e of this.ctx.enemies) e.kill()
    this.clearSurvivorsEntities()
    this.recomputeStats()
    this.ctx.health = this.ctx.maxHealthValue
    this.ctx.statShield = this.ctx.statShieldMax
    // Survivors: infinite RESERVE but a real magazine — you still reload (the
    // weapon's fire/reload cadence is part of the challenge), you just never run dry.
    this.ctx.ammo = WEAPONS[this.ctx.activeWeapon].magazineSize
    this.ctx.reserve = 0 // unused in Survivors (reload ignores reserve); shown as ∞
    this.ctx.reloading = false
  }

  clearSurvivorsEntities() {
    this.clearXpGems()
    for (const b of this.bolts) {
      this.ctx.scene.remove(b.mesh)
      b.mesh.geometry.dispose()
      ;(b.mesh.material as THREE.Material).dispose()
    }
    this.bolts = []
    for (const n of this.novas) {
      this.ctx.scene.remove(n.mesh)
      n.mesh.geometry.dispose()
      ;(n.mesh.material as THREE.Material).dispose()
    }
    this.novas = []
    this.rebuildOrbit(0)
    this.orbitGroup.visible = false
  }

  clearXpGems() {
    for (const g of this.xpGems) {
      this.ctx.scene.remove(g.sprite)
      g.sprite.material.dispose()
    }
    this.xpGems = []
  }

  /** Apply persistent shop tiers (called by React with the saved meta-progression). */
  setShopUpgrades(tiers: Record<string, number>) {
    this.shopTiers = tiers || {}
    if (this.ctx.survivors) this.recomputeStats()
  }

  setSurvivorClass(classId: SurvivorClassId) {
    if (!SURVIVOR_CLASSES[classId]) return
    this.selectedClass = classId
    this.ctx.survivorClassId = classId
    if (this.ctx.survivors) this.recomputeStats()
  }

  currentChapter() {
    return SURVIVOR_RUN_CHAPTERS[this.ctx.survivorChapter] ?? SURVIVOR_RUN_CHAPTERS[0]
  }

  currentChapterProgress(): number {
    const start = survivorChapterStart(this.ctx.survivorChapter)
    const chapter = this.currentChapter()
    return Math.max(0, Math.min(1, (this.survClock - start) / chapter.duration))
  }

  recomputeStats() {
    if (!this.ctx.survivors) {
      this.ctx.statDamageMul = 1
      this.ctx.statFireRateMul = 1
      this.ctx.statMoveMul = 1
      this.ctx.statMaxHpBonus = 0
      this.ctx.statRegen = 0
      this.ctx.statMagnet = SURV_BASE_MAGNET
      this.ctx.statXpMul = 1
      this.ctx.statCrit = 0
      this.ctx.statMultishot = 0
      this.ctx.statArmor = 0
      this.ctx.statShieldMax = 0
      this.ctx.statShield = 0
      this.ctx.statShieldRegen = 0
      this.ctx.statRetaliate = 0
      this.ctx.statKillHeal = 0
      this.ctx.statBastion = 0
      this.ctx.statDodge = 0
      this.ctx.statGrace = 0
      this.ctx.damageGraceTimer = 0
      this.statAmp = 1
      return
    }

    const lv = (id: UpgradeId) => this.upgradeLevels[id] ?? 0
    const sh = (id: string) => this.shopTiers[id] ?? 0
    const cls = SURVIVOR_CLASSES[this.ctx.survivorClassId] ?? SURVIVOR_CLASSES.ranger
    const prevShieldMax = this.ctx.statShieldMax
    this.ctx.statDamageMul = (cls.damageMul ?? 1) * (1 + 0.25 * lv('dmg')) * (1 + 0.08 * sh('might'))
    this.ctx.statFireRateMul = (cls.fireRateMul ?? 1) * (1 + 0.18 * lv('rate'))
    this.ctx.statMoveMul = (cls.moveMul ?? 1) * (1 + 0.12 * lv('speed')) * (1 + 0.06 * sh('swift'))
    this.ctx.statMaxHpBonus = (cls.maxHpBonus ?? 0) + 30 * lv('maxhp') + 18 * sh('vigor')
    this.ctx.statRegen = (cls.regen ?? 0) + 2 * lv('regen') + 0.8 * sh('regenP')
    this.ctx.statMagnet = SURV_BASE_MAGNET * (cls.magnetMul ?? 1) * (1 + 0.45 * lv('magnet')) * (1 + 0.24 * sh('magnetP'))
    this.ctx.statXpMul = (cls.xpMul ?? 1) * (1 + 0.2 * lv('xpgain')) * (1 + 0.12 * sh('scholar'))
    this.ctx.statCrit = (cls.crit ?? 0) + 0.12 * lv('crit')
    this.ctx.statMultishot = lv('multishot')
    this.ctx.statArmor = Math.min(0.72, (cls.armor ?? 0) + 0.1 * lv('armor'))
    this.ctx.statShieldMax = Math.max(0, (cls.shieldMax ?? 0) + 24 * lv('ward'))
    this.ctx.statShieldRegen = (cls.shieldRegen ?? 0) + 2.4 * lv('ward')
    this.ctx.statRetaliate = (cls.retaliate ?? 0) + 14 * lv('spikes')
    this.ctx.statKillHeal = (cls.killHeal ?? 0) + 0.9 * lv('bloodtap')
    this.ctx.statBastion = lv('bastion')
    this.ctx.statDodge = Math.min(0.42, 0.08 * lv('dodge'))
    this.ctx.statGrace = 0.24 * lv('grace')
    if (this.ctx.statShieldMax > prevShieldMax) {
      this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + (this.ctx.statShieldMax - prevShieldMax))
    } else {
      this.ctx.statShield = Math.min(this.ctx.statShield, this.ctx.statShieldMax)
    }
    this.statAmp = 1 + AMP_PER_TIER * lv('amp') // synergy: buffs the 3 auto-weapons
    this.orbitLevel = lv('orbit')
    this.boltLevel = lv('bolt')
    this.novaLevel = lv('nova')
    // L1 = 2 blades; Split Shot adds blades; Cyclone evolution adds 2 more.
    const orbitCount = this.orbitLevel
      ? this.orbitLevel + 1 + this.ctx.statMultishot + (this.evolved.orbit ? 2 : 0)
      : 0
    this.rebuildOrbit(orbitCount)
    if (this.ctx.survivors) this.orbitGroup.visible = this.orbitLevel > 0
  }

  rebuildOrbit(count: number) {
    for (const o of this.orbitOrbs) {
      this.orbitGroup.remove(o)
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
    this.orbitOrbs = []
    const evo = this.evolved.orbit
    const r = evo ? 0.44 : 0.32
    const color = evo ? 0xffd166 : 0x6fe7ff
    const emissive = evo ? 0xffae2e : 0x29c5ff
    for (let i = 0; i < count; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(r, 12, 10),
        new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 2.4, roughness: 0.3 }),
      )
      this.orbitGroup.add(orb)
      this.orbitOrbs.push(orb)
    }
  }

  gainXp(v: number) {
    this.xp += v * this.ctx.statXpMul
    let leveled = false
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = xpForLevel(this.level)
      this.pendingLevels++
      leveled = true
    }
    if (leveled && this.ctx.status === 'playing') this.triggerLevelUp()
  }

  triggerLevelUp() {
    this.ctx.status = 'levelup'
    this.rerolls = REROLLS_PER_LEVEL
    this.rollChoices()
    if (this.ctx.rig.captured) this.ctx.rig.releaseCapture()
    audio.sfx('levelup') // dedicated rising fanfare — the best beat in the mode
    this.sys.hud.emit()
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  /** A golden evolution card when a weapon AND its paired passive are both maxed. */
  private availableEvolutionCard(): UpgradeChoice | null {
    return availableEvolutionChoice(this.upgradeLevels, this.evolved)
  }

  rollChoices() {
    const evoCard = this.availableEvolutionCard()
    const eligible = this.shuffle(
      UPGRADES.filter((u) => (this.upgradeLevels[u.id] ?? 0) < u.max && !this.banished.has(u.id)),
    )
    // Early-run bias: if you own no auto-weapon yet, float one to the front so
    // runs reach a build instead of whiffing on passives.
    const ownsWeapon = WEAPON_UPGRADE_IDS.some((w) => (this.upgradeLevels[w] ?? 0) > 0)
    if (!ownsWeapon) {
      const wi = eligible.findIndex((u) => u.kind === 'weapon')
      if (wi > 0) eligible.unshift(eligible.splice(wi, 1)[0])
    }
    const slots = evoCard ? 2 : 3
    const needsDefensiveChoice =
      this.level <= 5 ||
      this.ctx.health / this.ctx.maxHealthValue <= 0.58 ||
      !DEFENSIVE_UPGRADES.some((id) => (this.upgradeLevels[id] ?? 0) > 0)
    if (needsDefensiveChoice && !eligible.slice(0, slots).some((u) => DEFENSIVE_UPGRADES.includes(u.id))) {
      const di = eligible.findIndex((u) => DEFENSIVE_UPGRADES.includes(u.id))
      if (di >= slots) eligible.splice(slots - 1, 0, eligible.splice(di, 1)[0])
    }
    const picks: UpgradeChoice[] = eligible.slice(0, slots).map((u) => ({
      id: u.id,
      name: u.name,
      desc: u.desc,
      icon: u.icon,
      level: this.upgradeLevels[u.id] ?? 0,
      max: u.max,
    }))
    this.choices = evoCard ? [evoCard, ...picks] : picks
  }

  /** Re-draw the current draft (spends a free re-roll). */
  reroll() {
    if (this.ctx.status !== 'levelup' || this.rerolls <= 0) return
    this.rerolls--
    this.rollChoices()
    audio.sfx('switch')
    this.sys.hud.emit()
  }

  /** Permanently remove an upgrade from this run's pool and re-draw (spends a banish). */
  banish(id: string) {
    if (this.ctx.status !== 'levelup' || this.banishes <= 0) return
    if (id.startsWith('evo-')) return // evolutions can't be banished
    const uid = id as UpgradeId
    if (!UPGRADE_BY_ID[uid] || this.banished.has(uid)) return
    this.banished.add(uid)
    this.banishes--
    this.rollChoices()
    audio.sfx('switch')
    this.sys.hud.emit()
  }

  /** Called from the React draft UI when a card is chosen. */
  pickUpgrade(id: string) {
    if (this.ctx.status !== 'levelup') return
    if (id.startsWith('evo-')) {
      const w = id.slice(4) as WeaponUpgradeId
      if (WEAPON_UPGRADE_IDS.includes(w) && !this.evolved[w]) {
        this.evolved[w] = true
        this.recomputeStats()
        audio.sfx('victory') // the climax beat
      }
    } else {
      const uid = id as UpgradeId
      if (UPGRADE_BY_ID[uid]) {
        const prev = this.upgradeLevels[uid] ?? 0
        this.upgradeLevels[uid] = prev + 1
        this.recomputeStats()
        if (uid === 'maxhp') this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + 30)
        if (uid === 'ward') this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 24)
        audio.sfx('pickup')
      }
    }
    this.pendingLevels = Math.max(0, this.pendingLevels - 1)
    if (this.pendingLevels > 0) {
      this.rerolls = REROLLS_PER_LEVEL
      this.rollChoices()
      this.sys.hud.emit()
    } else {
      this.choices = []
      this.ctx.status = 'playing'
      this.sys.hud.emit()
      this.sys.input.lockPointer()
    }
  }

  updateSurvivors(delta: number) {
    this.survClock += delta
    this.updateStructuredRun()
    if (this.ctx.status !== 'playing') return
    if (this.bastionTimer > 0) this.bastionTimer = Math.max(0, this.bastionTimer - delta)
    if (this.ctx.damageGraceTimer > 0) this.ctx.damageGraceTimer = Math.max(0, this.ctx.damageGraceTimer - delta)

    // regen
    if (this.ctx.statRegen > 0 && this.ctx.health > 0) {
      this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + this.ctx.statRegen * delta)
    }
    if (this.ctx.statShieldMax > 0 && this.ctx.health > 0) {
      this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + this.ctx.statShieldRegen * delta)
    }

    // escalating swarm spawns
    this.survSpawnTimer -= delta
    const chapter = this.currentChapter()
    const interval = Math.max(SURV_SPAWN_MIN, (SURV_SPAWN_START - this.survClock * 0.01) / chapter.spawnMul)
    const cap = Math.round(SURV_SPAWN_CAP * chapter.capMul)
    if (this.survSpawnTimer <= 0 && this.ctx.aliveCount < cap) {
      this.spawnSwarmEnemy(false)
      this.survSpawnTimer = interval
    }
    this.eliteTimer -= delta
    if (this.eliteTimer <= 0) {
      this.sys.hud.announce('ELITE') // telegraph the beat (was a silent spawn)
      audio.sfx('boss')
      this.spawnSwarmEnemy(true)
      this.eliteTimer = chapter.eliteInterval
    }

    // Horde swells: a sudden wall of fodder so the curve pulses instead of
    // creeping linearly — the "oh no" moment that forces you onto your build.
    this.swellTimer -= delta
    if (this.swellTimer <= 0) {
      this.swellTimer = chapter.swellInterval
      this.triggerSwell()
    }

    this.updateOrbit(delta)
    this.updateBolts(delta)
    this.updateNovas(delta)
    this.updateXpGems(delta)
  }

  private updateStructuredRun() {
    if (this.survClock >= SURVIVOR_RUN_GOAL_TIME) {
      this.sys.hud.announce('BREACH SEALED')
      this.sys.gameOver.gameOver('win')
      return
    }

    const nextChapter = survivorChapterAt(this.survClock)
    if (nextChapter !== this.ctx.survivorChapter) this.advanceChapter(nextChapter)
  }

  private advanceChapter(index: number) {
    const chapter = SURVIVOR_RUN_CHAPTERS[index]
    if (!chapter) return
    this.ctx.survivorChapter = index
    this.sys.projectiles.clearProjectiles()
    for (const e of this.ctx.enemies) e.kill()
    this.clearXpGems()
    this.sys.arena.buildArena(getMap(chapter.mapId))
    this.sys.arena.placeAtSpawn()
    this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + 32)
    this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 24)
    this.survSpawnTimer = 0.35
    this.eliteTimer = Math.min(this.eliteTimer, chapter.eliteInterval)
    this.swellTimer = Math.min(this.swellTimer, chapter.swellInterval)
    this.sys.hud.announce(`${index + 1}/${SURVIVOR_RUN_CHAPTERS.length} · ${chapter.name.toUpperCase()}`)
    audio.sfx('breach')
  }

  spawnSwarmEnemy(elite: boolean) {
    const enemy = this.sys.pve.getFreeEnemy()
    // spawn on a ring around the player, just out of immediate sight
    const a = Math.random() * Math.PI * 2
    const r = 26 + Math.random() * 10
    let x = this.ctx.camera.position.x + Math.cos(a) * r
    let z = this.ctx.camera.position.z + Math.sin(a) * r
    x = Math.max(this.ctx.bounds.minX + 2, Math.min(this.ctx.bounds.maxX - 2, x))
    z = Math.max(this.ctx.bounds.minZ + 2, Math.min(this.ctx.bounds.maxZ - 2, z))
    const chapter = this.currentChapter()
    const timeScale = (1 + this.survClock * 0.01) * chapter.hpMul // HP scales with time + chapter
    const speedScale = (1 + this.survClock * 0.0035) * chapter.speedMul

    if (elite) {
      enemy.spawnAt(x, z, {
        maxHealth: SURV_ENEMY_BASE_HP * timeScale * 9,
        speed: 2.2 * speedScale,
        color: 0xff1f4f,
        isBoss: true,
        scale: 2.2,
        attackDamage: 16,
        projectileDamage: 7,
      })
      this.enemyXp.set(enemy, SURV_XP_ELITE_VALUE)
      return
    }

    const arch = this.rollArchetype()
    enemy.spawnAt(x, z, {
      maxHealth: SURV_ENEMY_BASE_HP * timeScale * arch.hpMul,
      speed: (2.6 + Math.random() * 1.0) * arch.speedMul * speedScale,
      archetype: arch.id,
      color: arch.color,
      scale: arch.scale,
      ranged: arch.ranged,
      flying: arch.flying,
      hoverHeight: arch.hoverHeight,
      attackDamage: arch.attackDamage,
      projectileDamage: arch.projectileDamage ?? 7,
    })
    this.enemyXp.set(enemy, arch.xp)
  }

  /** Weighted archetype roll — fodder starts early, specials fold in as breach pressure rises. */
  private rollArchetype(): SurvArchetype {
    return pickWeightedEnemyArchetype(this.survClock, this.ctx.survivorChapter)
  }

  /** Burst-spawn a wall of fodder (ignores the steady cap up to SURV_SWELL_CAP). */
  private triggerSwell() {
    this.sys.hud.announce('BREACH SURGE')
    audio.sfx('wave')
    const headroom = SURV_SWELL_CAP - this.ctx.aliveCount
    const n = Math.min(SURV_SWELL_COUNT, Math.max(0, headroom))
    for (let i = 0; i < n; i++) this.spawnSwarmEnemy(false)
  }

  /** Apply damage from an auto-weapon (handles death + XP, no crosshair marker). */
  autoDamageEnemy(enemy: Enemy, dmg: number) {
    if (!enemy.alive) return
    const crit = this.ctx.statCrit > 0 && Math.random() < this.ctx.statCrit
    // statAmp (Overcharge) + crit make a passive build empower the auto-weapons.
    const total = dmg * this.ctx.statDamageMul * this.statAmp * (crit ? 2 : 1)
    const res = enemy.takeDamage(total, false)
    this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.6), total, crit ? 'crit' : 'normal')
    this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.35), crit)
    if (res.died) this.sys.pve.onEnemyDeath(enemy, false)
  }

  onPlayerDamaged(rawDamage: number, healthDamage: number) {
    if (rawDamage <= 0) return
    if (this.ctx.statRetaliate > 0) {
      const px = this.ctx.camera.position.x
      const pz = this.ctx.camera.position.z
      const radius = 5.2
      const dmg = this.ctx.statRetaliate + rawDamage * 0.6
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive) continue
        const dx = enemy.position.x - px
        const dz = enemy.position.z - pz
        const d = Math.hypot(dx, dz)
        if (d > radius + enemy.radius) continue
        const k = d > 0.001 ? 1 / d : 1
        const res = enemy.takeDamage(dmg, false, 4, dx * k, dz * k)
        this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.5), dmg, 'normal')
        if (res.died) this.sys.pve.onEnemyDeath(enemy, false)
      }
    }

    if (this.ctx.statBastion > 0 && healthDamage > 0 && this.ctx.health / this.ctx.maxHealthValue <= 0.42 && this.bastionTimer <= 0) {
      this.bastionTimer = Math.max(3.2, 8.2 - this.ctx.statBastion * 1.6)
      this.castBastionPulse()
    }
  }

  onEnemyKilled(_enemy: Enemy, elite: boolean) {
    if (this.ctx.statKillHeal > 0 && this.ctx.health > 0) {
      const heal = this.ctx.statKillHeal * (elite ? 5 : 1)
      this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + heal)
    }
  }

  private castBastionPulse() {
    this.sys.hud.announce('BASTION PULSE')
    audio.sfx('shieldUp')
    const center = this.ctx.camera.position
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 1.0, 46),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(center.x, 0.22, center.z)
    ring.scale.setScalar(0.001)
    this.ctx.scene.add(ring)
    this.novas.push({
      mesh: ring,
      age: 0,
      ttl: 0.45,
      hit: new Set(),
      dmg: 36 + this.ctx.statBastion * 24,
      maxR: 8 + this.ctx.statBastion * 1.6,
    })
    this.ctx.statShield = Math.min(this.ctx.statShieldMax, this.ctx.statShield + 12 + this.ctx.statBastion * 8)
    this.sys.fx.addShake(0.24)
  }

  updateOrbit(delta: number) {
    if (this.orbitLevel <= 0) {
      this.orbitGroup.visible = false
      return
    }
    this.orbitGroup.visible = true
    this.orbitGroup.position.set(this.ctx.camera.position.x, 1.2, this.ctx.camera.position.z)
    const evo = this.evolved.orbit // CYCLONE: bigger, faster, deadlier
    this.orbitAngle += ORBIT_SPEED * (evo ? 1.6 : 1) * delta
    const ringR = ORBIT_RADIUS * (evo ? 1.25 : 1)
    const n = this.orbitOrbs.length
    for (let i = 0; i < n; i++) {
      const ang = this.orbitAngle + (i / n) * Math.PI * 2
      this.orbitOrbs[i].position.set(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR)
    }
    const dmg = ORBIT_DMG * (1 + 0.25 * (this.orbitLevel - 1)) * (evo ? 1.6 : 1)
    const hitR = ORBIT_HIT_RADIUS * (evo ? 1.8 : 1)
    const now = this.survClock
    for (const enemy of this.ctx.enemies) {
      if (!enemy.alive) continue
      const ep = enemy.position
      let near = false
      for (const orb of this.orbitOrbs) {
        const ox = this.orbitGroup.position.x + orb.position.x
        const oz = this.orbitGroup.position.z + orb.position.z
        if (Math.hypot(ep.x - ox, ep.z - oz) < hitR + enemy.radius) {
          near = true
          break
        }
      }
      if (near && (this.orbitCd.get(enemy) ?? 0) <= now) {
        this.orbitCd.set(enemy, now + ORBIT_HIT_CD)
        this.autoDamageEnemy(enemy, dmg)
      }
    }
  }

  updateBolts(delta: number) {
    if (this.boltLevel > 0) {
      this.boltTimer -= delta
      const evo = this.evolved.bolt // HAILSTORM: faster, more, piercing
      const interval = Math.max(0.12, (0.9 - 0.08 * (this.boltLevel - 1)) * (evo ? 0.55 : 1))
      if (this.boltTimer <= 0) {
        this.boltTimer = interval
        const count = 1 + Math.floor((this.boltLevel - 1) / 2) + this.ctx.statMultishot + (evo ? 2 : 0)
        for (let i = 0; i < count; i++) this.fireBolt()
      }
    }
    const eyeY = 1.3
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.age += delta
      // light homing toward nearest enemy
      const tgt = this.nearestEnemy(b.mesh.position)
      if (tgt) {
        const dx = tgt.position.x - b.mesh.position.x
        const dz = tgt.position.z - b.mesh.position.z
        const d = Math.hypot(dx, dz) || 1
        const cur = b.vel.length() || BOLT_SPEED
        b.vel.x += (dx / d) * cur * 2.5 * delta
        b.vel.z += (dz / d) * cur * 2.5 * delta
        b.vel.setLength(cur)
      }
      b.mesh.position.addScaledVector(b.vel, delta)
      b.mesh.position.y = eyeY
      let hitEnemy: Enemy | null = null
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive) continue
        if (Math.hypot(enemy.position.x - b.mesh.position.x, enemy.position.z - b.mesh.position.z) < 0.8 + enemy.radius) {
          hitEnemy = enemy
          break
        }
      }
      if (hitEnemy) {
        this.autoDamageEnemy(hitEnemy, b.dmg)
        b.pierce -= 1
        if (b.pierce < 0) {
          this.removeBolt(i)
          continue
        }
      }
      if (b.age > BOLT_TTL || !this.ctx.bounds.containsXZ(b.mesh.position.x, b.mesh.position.z, 1)) {
        this.removeBolt(i)
      }
    }
  }

  fireBolt() {
    const tgt = this.nearestEnemy(this.ctx.camera.position)
    if (!tgt) return
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8affff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    mesh.position.set(this.ctx.camera.position.x, 1.3, this.ctx.camera.position.z)
    const dx = tgt.position.x - mesh.position.x
    const dz = tgt.position.z - mesh.position.z
    const d = Math.hypot(dx, dz) || 1
    const vel = new THREE.Vector3((dx / d) * BOLT_SPEED, 0, (dz / d) * BOLT_SPEED)
    this.ctx.scene.add(mesh)
    const pierce = Math.floor((this.boltLevel - 1) / 2) + (this.evolved.bolt ? 2 : 0)
    this.bolts.push({ mesh, vel, dmg: BOLT_DMG * (1 + 0.18 * (this.boltLevel - 1)), age: 0, pierce })
    audio.sfx('hit')
  }

  removeBolt(i: number) {
    const b = this.bolts[i]
    this.ctx.scene.remove(b.mesh)
    b.mesh.geometry.dispose()
    ;(b.mesh.material as THREE.Material).dispose()
    this.bolts.splice(i, 1)
  }

  updateNovas(delta: number) {
    if (this.novaLevel > 0) {
      this.novaTimer -= delta
      // SUPERNOVA: erupts roughly twice as often
      const interval = Math.max(0.9, (NOVA_INTERVAL - 0.22 * (this.novaLevel - 1)) * (this.evolved.nova ? 0.5 : 1))
      if (this.novaTimer <= 0) {
        this.novaTimer = interval
        this.castNova()
      }
    }
    for (let i = this.novas.length - 1; i >= 0; i--) {
      const nv = this.novas[i]
      nv.age += delta
      const t = nv.age / nv.ttl
      const radius = nv.maxR * t
      nv.mesh.scale.setScalar(Math.max(0.001, radius))
      ;(nv.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - t))
      // damage enemies the ring has reached (once each)
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive || nv.hit.has(enemy)) continue
        const d = Math.hypot(enemy.position.x - nv.mesh.position.x, enemy.position.z - nv.mesh.position.z)
        if (d <= radius) {
          nv.hit.add(enemy)
          this.autoDamageEnemy(enemy, nv.dmg)
        }
      }
      if (nv.age >= nv.ttl) {
        this.ctx.scene.remove(nv.mesh)
        nv.mesh.geometry.dispose()
        ;(nv.mesh.material as THREE.Material).dispose()
        this.novas.splice(i, 1)
      }
    }
  }

  castNova() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.0, 40),
      new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(this.ctx.camera.position.x, 0.2, this.ctx.camera.position.z)
    ring.scale.setScalar(0.001)
    this.ctx.scene.add(ring)
    this.novas.push({
      mesh: ring,
      age: 0,
      ttl: 0.55,
      hit: new Set(),
      dmg: NOVA_DMG * (1 + 0.3 * (this.novaLevel - 1)) * (this.evolved.nova ? 1.4 : 1),
      maxR: NOVA_RADIUS * (1 + 0.12 * (this.novaLevel - 1)) * (this.evolved.nova ? 1.5 : 1),
    })
    audio.sfx('boss')
  }

  nearestEnemy(from: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null
    let bestD = Infinity
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue
      const d = (e.position.x - from.x) ** 2 + (e.position.z - from.z) ** 2
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  /** Elites ("bosses") drop survival rewards on top of their big XP gem. */
  onEliteKilled(pos: THREE.Vector3) {
    this.sys.pickups.spawnPickup('health', pos.x + 1.2, pos.z)
    this.sys.pickups.spawnPickup('damage', pos.x - 1.2, pos.z)
  }

  dropXpGem(pos: THREE.Vector3, value: number) {
    const big = value > 1
    const mat = new THREE.SpriteMaterial({
      map: XP_BLOOD_TEXTURE,
      color: big ? 0xffd166 : 0xffffff,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      toneMapped: false,
    })
    const sprite = new THREE.Sprite(mat)
    const scale = big ? XP_BLOOD_SCALE[0] * 1.35 : XP_BLOOD_SCALE[0]
    sprite.scale.set(scale, scale, 1)
    sprite.position.set(pos.x, 0.65, pos.z)
    sprite.userData = { baseScale: scale, baseY: 0.65 }
    this.ctx.scene.add(sprite)
    this.xpGems.push({ sprite, value, age: 0 })
  }

  updateXpGems(delta: number) {
    const px = this.ctx.camera.position.x
    const pz = this.ctx.camera.position.z
    for (let i = this.xpGems.length - 1; i >= 0; i--) {
      const g = this.xpGems[i]
      g.age += delta
      g.sprite.material.rotation += delta * 2.5
      g.sprite.position.y = 0.65 + Math.sin(g.age * 4) * 0.1
      const pulse = 1 + Math.sin(g.age * 6) * 0.07
      const baseScale = (g.sprite.userData.baseScale as number | undefined) ?? XP_BLOOD_SCALE[0]
      g.sprite.scale.set(baseScale * pulse, baseScale * pulse, 1)
      const d = Math.hypot(g.sprite.position.x - px, g.sprite.position.z - pz)
      if (d < this.ctx.statMagnet) {
        // magnet pull
        const pull = (1 - d / this.ctx.statMagnet) * 38 + 7
        g.sprite.position.x += ((px - g.sprite.position.x) / (d || 1)) * pull * delta
        g.sprite.position.z += ((pz - g.sprite.position.z) / (d || 1)) * pull * delta
      }
      if (d < 1.6) {
        this.gainXp(g.value)
        this.ctx.scene.remove(g.sprite)
        g.sprite.material.dispose()
        this.xpGems.splice(i, 1)
      }
    }
  }

  /** Build summary for the HUD level-up / loadout panels. */
  buildList(): BuildEntry[] {
    return survivorBuildList(this.upgradeLevels, this.evolved)
  }
}
