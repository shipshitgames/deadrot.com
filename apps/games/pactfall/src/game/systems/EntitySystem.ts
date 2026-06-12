import * as THREE from "three";
import { COLORS, CONSTANTS, MARCH_DIR, type Team } from "../constants";
import { makeBase, makeChampion, makeMinion, makeScourge } from "../factory";
import type { Game } from "../Game";
import type { Entity, GameEvents } from "../types";
import { slowedSpeed } from "./abilities";
import { clampToLane, stepToward } from "./movement";

// Owns every entity, the spawn cadence, movement, targeting, combat, and the
// transient attack beams. This is where the core loop actually lives.
export class EntitySystem {
  private nextId = 1;
  private all: Entity[] = [];

  champion!: Entity; // the player (Pyre)
  enemyChampion!: Entity; // the AI opponent (Warden)
  friendlyBase!: Entity;
  enemyBase!: Entity;
  scourge!: Entity;

  // The player champion's last lane-space move direction (x = strafe, y = +Z
  // forward). Abilities aim along this when there's no cursor to aim at.
  readonly playerFacing = new THREE.Vector2(0, 1);
  private readonly playerMoveVel = new THREE.Vector2(0, 0);
  private wasPlayerMoving = false;
  private playerMoveStartBoostTimer = 0;

  // Gameplay events accumulated each tick; the Game consumes + clears them
  // once per displayed frame for juice and audio.
  readonly events: GameEvents = {
    hits: [],
    kills: [],
    playerDamage: 0,
    playerDied: false,
    buffGained: false,
  };

  private spawnTimers: Record<Team, number> = { pyre: 0, warden: 0 };
  private scourgeRespawn = 0; // > 0 means the blob is dead and counting down
  // > 0 means that team's champion is dead and counting down to redeploy.
  private championDown: Record<Team, number> = { pyre: 0, warden: 0 };

  // Pooled transient beams (champion + minion attack flashes).
  private beams: { mesh: THREE.Mesh; life: number; max: number }[] = [];

  constructor(private readonly game: Game) {}

  clearEvents(): void {
    this.events.hits.length = 0;
    this.events.kills.length = 0;
    this.events.playerDamage = 0;
    this.events.playerDied = false;
    this.events.buffGained = false;
  }

  reset(): void {
    for (const e of this.all) this.game.render.remove(e.mesh);
    for (const b of this.beams) this.game.render.remove(b.mesh);
    this.all = [];
    this.beams = [];
    this.nextId = 1;
    // Stagger the first waves so the lane isn't a perfect mirror that locks at
    // center — one side's wave arrives first and the front line can actually move.
    this.spawnTimers = { pyre: 0, warden: 1.3 };
    this.scourgeRespawn = 0;
    this.championDown = { pyre: 0, warden: 0 };
    this.playerFacing.set(0, 1);
    this.playerMoveVel.set(0, 0);
    this.wasPlayerMoving = false;
    this.playerMoveStartBoostTimer = 0;
    this.clearEvents();

    this.champion = this.spawn(makeChampion("pyre"));
    this.champion.pos.copy(this.championSpawnPos("pyre"));

    this.enemyChampion = this.spawn(makeChampion("warden"));
    this.enemyChampion.pos.copy(this.championSpawnPos("warden"));

    this.friendlyBase = this.spawn(makeBase("pyre"));
    this.friendlyBase.pos.set(0, CONSTANTS.base.height / 2, CONSTANTS.base.friendlyZ);

    this.enemyBase = this.spawn(makeBase("warden"));
    this.enemyBase.pos.set(0, CONSTANTS.base.height / 2, CONSTANTS.base.enemyZ);

    this.scourge = this.spawn(makeScourge());
    this.scourge.pos.set(0, CONSTANTS.scourge.radius + 0.4, 0);

    this.syncMeshes();
  }

  private spawn(e: Entity): Entity {
    e.id = this.nextId++;
    this.all.push(e);
    this.game.render.add(e.mesh);
    return e;
  }

  // Where each champion (re)deploys: just out in front of its own base.
  private championSpawnPos(team: Team): THREE.Vector3 {
    const y = CONSTANTS.champion.height / 2;
    const z = team === "pyre" ? CONSTANTS.champion.respawnZ : -CONSTANTS.champion.respawnZ;
    return new THREE.Vector3(0, y, z);
  }

  update(dt: number): void {
    // Pact Brand slow decays everywhere in one pass.
    for (const e of this.all) {
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);
    }

    this.tickSpawns(dt);
    this.tickScourgeRespawn(dt);
    this.tickChampionRespawns(dt);

    this.moveChampion(dt);
    this.moveEnemyChampion(dt);
    this.moveMinions(dt);

    this.tickCombat(dt);
    this.tickBeams(dt);

    this.cull();
    this.syncMeshes();
    this.checkObjectives();
  }

  // ---- spawning -----------------------------------------------------------

  private tickSpawns(dt: number): void {
    (["pyre", "warden"] as Team[]).forEach((team) => {
      this.spawnTimers[team] -= dt;
      if (this.spawnTimers[team] <= 0) {
        this.spawnTimers[team] = CONSTANTS.minion.spawnInterval;
        for (let i = 0; i < CONSTANTS.minion.waveSize; i++) this.spawnMinion(team, i);
      }
    });
  }

  private spawnMinion(team: Team, lateral: number): void {
    const m = this.spawn(makeMinion(team));
    const fromZ = team === "pyre" ? CONSTANTS.base.friendlyZ + 3 : CONSTANTS.base.enemyZ - 3;
    const offset = (lateral - (CONSTANTS.minion.waveSize - 1) / 2) * 1.6;
    m.pos.set(offset, CONSTANTS.minion.radius, fromZ);
  }

  private tickScourgeRespawn(dt: number): void {
    if (this.scourge.alive) return;
    this.scourgeRespawn -= dt;
    if (this.scourgeRespawn <= 0) {
      this.scourge.alive = true;
      this.scourge.hp = this.scourge.maxHp;
      this.scourge.mesh.visible = true;
    }
  }

  private tickChampionRespawns(dt: number): void {
    (["pyre", "warden"] as Team[]).forEach((team) => {
      if (this.championDown[team] <= 0) return;
      this.championDown[team] -= dt;
      if (this.championDown[team] <= 0) {
        const c = team === "pyre" ? this.champion : this.enemyChampion;
        c.alive = true;
        c.hp = c.maxHp;
        c.mana = c.maxMana;
        c.cooldown = 0;
        c.slowTimer = 0;
        c.mesh.visible = true;
        c.pos.copy(this.championSpawnPos(team));
        if (team === "pyre") {
          this.playerMoveVel.set(0, 0);
          this.wasPlayerMoving = false;
          this.playerMoveStartBoostTimer = 0;
        }
      }
    });
  }

  // ---- movement -----------------------------------------------------------

  private moveChampion(dt: number): void {
    const c = this.champion;
    if (!c.alive) return;
    const input = this.game.input;
    const speed = slowedSpeed(CONSTANTS.champion.moveSpeed, c.slowTimer, CONSTANTS.abilities.w.slowFactor);
    const desired = new THREE.Vector2(0, 0);
    let clickTarget: THREE.Vector3 | null = null;

    if (input.hasKeyboardMove) {
      desired.set(input.move.x, input.move.y).multiplyScalar(speed);
      this.playerFacing.set(input.move.x, input.move.y).normalize();
    } else if (input.clickTarget) {
      const t = input.clickTarget;
      if (Math.hypot(t.x - c.pos.x, t.z - c.pos.z) < 0.2) {
        input.clickTarget = null;
      } else {
        // Abilities aim along the move direction; record it before the step
        // mutates the position.
        this.playerFacing.set(t.x - c.pos.x, t.z - c.pos.z).normalize();
        desired.set(this.playerFacing.x, this.playerFacing.y).multiplyScalar(speed);
        clickTarget = t;
      }
    }
    this.applyPlayerVelocity(c.pos, desired, dt, clickTarget);

    // Don't let the player walk back onto its own base (that would wall the camera);
    // retreatZ keeps the base safely behind the follow-cam.
    clampToLane(c.pos, CONSTANTS.champion.retreatZ);
  }

  private applyPlayerVelocity(pos: THREE.Vector3, desired: THREE.Vector2, dt: number, clickTarget: THREE.Vector3 | null) {
    const moving = desired.lengthSq() > 0;
    if (moving && !this.wasPlayerMoving) this.playerMoveStartBoostTimer = CONSTANTS.champion.moveStartBoostTime;
    this.wasPlayerMoving = moving;

    const damping = moving ? CONSTANTS.champion.moveDamping : CONSTANTS.champion.moveBrakeDamping;
    this.playerMoveVel.multiplyScalar(Math.max(0, 1 - damping * dt));

    if (moving) {
      const boost =
        this.playerMoveStartBoostTimer > 0
          ? 1 +
            CONSTANTS.champion.moveStartBoostMultiplier *
              (this.playerMoveStartBoostTimer / CONSTANTS.champion.moveStartBoostTime)
          : 1;
      const maxStep = CONSTANTS.champion.moveAccel * boost * dt;
      const delta = desired.clone().sub(this.playerMoveVel);
      const dist = delta.length();
      if (dist > maxStep && dist > 0) this.playerMoveVel.add(delta.multiplyScalar(maxStep / dist));
      else this.playerMoveVel.copy(desired);
    } else if (this.playerMoveVel.length() < CONSTANTS.champion.moveStopEpsilon) {
      this.playerMoveVel.set(0, 0);
    }
    this.playerMoveStartBoostTimer = Math.max(0, this.playerMoveStartBoostTimer - dt);

    const stepX = this.playerMoveVel.x * dt;
    const stepZ = this.playerMoveVel.y * dt;
    if (clickTarget) {
      const toTargetX = clickTarget.x - pos.x;
      const toTargetZ = clickTarget.z - pos.z;
      const before = Math.hypot(toTargetX, toTargetZ);
      if (before <= Math.hypot(stepX, stepZ) + 0.2) {
        pos.x = clickTarget.x;
        pos.z = clickTarget.z;
        this.playerMoveVel.set(0, 0);
        this.game.input.clickTarget = null;
        return;
      }
    }
    pos.x += stepX;
    pos.z += stepZ;
  }

  // Simple lane AI for the Warden champion: chase the nearest Pyre unit to
  // attack range, otherwise march on the Pyre base and siege it.
  private moveEnemyChampion(dt: number): void {
    const c = this.enemyChampion;
    if (!c.alive) return;
    const speed = slowedSpeed(CONSTANTS.champion.moveSpeed, c.slowTimer, CONSTANTS.abilities.w.slowFactor);

    const foe = this.nearestFoeAny(c);
    let tx: number;
    let tz: number;
    let stop: number;
    if (foe) {
      tx = foe.pos.x;
      tz = foe.pos.z;
      stop = c.attackRange + foe.radius - 0.6; // close to just inside attack range
    } else {
      tx = this.friendlyBase.pos.x;
      tz = this.friendlyBase.pos.z;
      stop = CONSTANTS.base.championRange + this.friendlyBase.radius - 0.6;
    }

    stepToward(c.pos, tx, tz, speed, dt, stop);
    clampToLane(c.pos, CONSTANTS.base.friendlyZ - 1);
  }

  private moveMinions(dt: number): void {
    for (const m of this.all) {
      if (m.kind !== "minion" || !m.alive) continue;
      const team = m.team as Team;

      // Hold position to fight a unit foe in range...
      if (this.nearestFoe(m, m.attackRange)) continue;

      // ...or to siege the opposing base once it's reached.
      const base = this.opposingBase(team);
      if (base.alive && this.flatDist(m.pos, base.pos) <= m.attackRange + base.radius) continue;

      const speed = slowedSpeed(CONSTANTS.minion.moveSpeed, m.slowTimer, CONSTANTS.abilities.w.slowFactor);
      m.pos.z += MARCH_DIR[team] * speed * dt;
    }
  }

  // ---- combat -------------------------------------------------------------

  private tickCombat(dt: number): void {
    for (const e of this.all) {
      if (!e.alive || e.kind === "base" || e.kind === "scourge") continue;
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.cooldown > 0) continue;

      if (e.kind === "champion") {
        const isPlayer = e === this.champion;
        const opposing = isPlayer ? this.enemyBase : this.friendlyBase;
        const target = this.acquireTarget(e, opposing, isPlayer);
        if (target) {
          const buffed = isPlayer && this.game.buffed;
          const dmg = e.attackDamage * (buffed ? CONSTANTS.scourge.buffMultiplier : 1);
          this.damage(target, dmg, { dealer: e });
          const color = isPlayer ? (buffed ? COLORS.toxic : COLORS.hellfire) : COLORS.bloodHot;
          this.beam(e.pos, target.pos, color, 0.42, 1);
          e.cooldown = e.attackCooldown;
        }
      } else if (e.kind === "minion") {
        const foe = this.nearestFoe(e, e.attackRange);
        if (foe) {
          this.damage(foe, e.attackDamage, { dealer: e });
          this.beam(e.pos, foe.pos, COLORS.blood, 0.18, 0.4);
          e.cooldown = e.attackCooldown;
        } else {
          // No unit in range — chip the opposing base if we've sieged up to it.
          const base = this.opposingBase(e.team as Team);
          if (base.alive && this.flatDist(e.pos, base.pos) <= e.attackRange + base.radius) {
            this.damage(base, e.attackDamage, { dealer: e });
            this.beam(e.pos, base.pos, COLORS.blood, 0.2, 0.5);
            e.cooldown = e.attackCooldown;
          }
        }
      }
    }
  }

  // Auto-target priority for a champion: nearest enemy unit, then (player only)
  // the Scourge blob, then the opposing base once pushed up to it.
  private acquireTarget(c: Entity, opposingBase: Entity, scourgeEligible: boolean): Entity | null {
    const r = c.attackRange;

    const unit = this.nearestFoe(c, r);
    if (unit) return unit;

    if (scourgeEligible && this.scourge.alive && this.flatDist(c.pos, this.scourge.pos) <= r + this.scourge.radius) {
      return this.scourge;
    }

    if (
      opposingBase.alive &&
      this.flatDist(c.pos, opposingBase.pos) <= CONSTANTS.base.championRange + opposingBase.radius
    ) {
      return opposingBase;
    }
    return null;
  }

  private nearestFoe(self: Entity, range: number): Entity | null {
    let best: Entity | null = null;
    let bestD = range;
    for (const e of this.all) {
      if (!e.alive || e === self) continue;
      if (e.kind !== "minion" && e.kind !== "champion") continue;
      if (!this.areEnemies(self, e)) continue;
      const d = this.flatDist(self.pos, e.pos) - e.radius;
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // Nearest enemy unit at any distance — used by the Warden AI to pick a chase target.
  private nearestFoeAny(self: Entity): Entity | null {
    return this.nearestFoe(self, Number.POSITIVE_INFINITY);
  }

  private opposingBase(team: Team): Entity {
    return team === "pyre" ? this.enemyBase : this.friendlyBase;
  }

  /** Every living unit (minion or champion) hostile to the given team. */
  unitsHostileTo(team: Team): Entity[] {
    return this.all.filter(
      (e) => e.alive && (e.kind === "minion" || e.kind === "champion") && e.team !== team && e.team !== "neutral",
    );
  }

  private areEnemies(a: Entity, b: Entity): boolean {
    if (a.team === "neutral" || b.team === "neutral") return false;
    return a.team !== b.team;
  }

  damage(target: Entity, amount: number, source?: { dealer: Entity; ability?: boolean }): void {
    if (!target.alive) return;
    target.hp -= amount;

    const dealer = source?.dealer ?? null;
    // Hit events only for champion-dealt damage — minion skirmish chip would
    // drown the HUD in numbers without telling the player anything.
    if (dealer && dealer.kind === "champion" && dealer.team !== "neutral") {
      this.events.hits.push({
        x: target.pos.x,
        y: target.pos.y + target.radius,
        z: target.pos.z,
        amount,
        ability: source?.ability ?? false,
        dealerTeam: dealer.team as Team,
        dealerIsPlayer: dealer === this.champion,
        targetIsPlayer: target === this.champion,
      });
    }
    if (target === this.champion) this.events.playerDamage += amount;

    if (target.hp <= 0) this.kill(target, dealer);
  }

  private kill(e: Entity, dealer: Entity | null = null): void {
    e.hp = 0;

    if (e.kind !== "base") {
      this.events.kills.push({
        x: e.pos.x,
        y: e.pos.y,
        z: e.pos.z,
        kind: e.kind,
        dealerTeam: dealer && dealer.team !== "neutral" ? (dealer.team as Team) : null,
        dealerIsPlayer: dealer === this.champion,
        victimIsPlayer: e === this.champion,
      });
    }

    if (e.kind === "scourge") {
      // Slaying the Scourge grants the champion a temporary damage buff.
      e.alive = false;
      e.mesh.visible = false;
      this.scourgeRespawn = CONSTANTS.scourge.respawn;
      this.game.grantBuff();
      this.events.buffGained = true;
      return;
    }

    if (e.kind === "champion") {
      // Champions go down and redeploy after a delay — death now has a cost.
      e.alive = false;
      e.mesh.visible = false;
      this.championDown[e.team as Team] = CONSTANTS.champion.respawnDelay;
      if (e === this.champion) {
        this.game.input.clickTarget = null; // drop any stale move order
        this.events.playerDied = true;
      }
      return;
    }

    e.alive = false; // minion (culled) or base (kept for the win/lose check)
  }

  // ---- transient beams ----------------------------------------------------

  beam(from: THREE.Vector3, to: THREE.Vector3, color: number, life: number, thick: number): void {
    const a = from.clone();
    a.y = 1.1;
    const b = to.clone();
    b.y = 1.0;
    const len = a.distanceTo(b);
    if (len < 0.001) return;

    const geo = new THREE.CylinderGeometry(0.06 * thick, 0.06 * thick, len, 6, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.game.render.add(mesh);
    this.beams.push({ mesh, life, max: life });
  }

  private tickBeams(dt: number): void {
    for (const b of this.beams) {
      b.life -= dt;
      const mat = b.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, b.life / b.max) * 0.95;
    }
    const dead = this.beams.filter((b) => b.life <= 0);
    for (const b of dead) {
      this.game.render.remove(b.mesh);
      (b.mesh.geometry as THREE.BufferGeometry).dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.beams = this.beams.filter((b) => b.life > 0);
  }

  // ---- bookkeeping --------------------------------------------------------

  private cull(): void {
    const dead = this.all.filter((e) => !e.alive && e.kind === "minion");
    for (const e of dead) {
      this.game.render.remove(e.mesh);
      this.disposeMesh(e.mesh);
    }
    if (dead.length) this.all = this.all.filter((e) => !dead.includes(e));
  }

  private disposeMesh(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((x) => {
          x.dispose();
        });
      } else mat?.dispose();
    });
  }

  private syncMeshes(): void {
    for (const e of this.all) {
      e.mesh.position.copy(e.pos);
    }
    // Pulse the living Scourge blob.
    if (this.scourge.alive) {
      const p = 1 + Math.sin(this.game.elapsed * 4) * 0.06;
      this.scourge.mesh.scale.setScalar(p);
    }
  }

  // ---- win / lose ---------------------------------------------------------

  private checkObjectives(): void {
    if (!this.enemyBase.alive) this.game.win();
    if (!this.friendlyBase.alive) this.game.lose();
  }

  private flatDist(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
