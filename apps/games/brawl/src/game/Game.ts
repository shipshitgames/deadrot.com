import { recordWarResult } from "@deadrot/game-kit/core";
import { reportWarlineOperation } from "@deadrot/game-kit/warline";
import * as THREE from "three";
import {
  ARENA_RULES,
  aliveCount,
  arenaCameraFocus,
  chooseArenaRoster,
  clampSlots,
  fighterWeight,
  isOverVoid,
  isRingOut,
  knockback,
  launchBonus,
  nearestTarget,
  rankArena,
  recoveryDir,
  resolveSupport,
  strongerLaunch,
  wouldStepOffEdge,
} from "./arena";
import { ATTACKS, attackDamage, guardedDamage } from "./combat";
import { ARENA } from "./constants";
import { DEFAULT_PLAYER_ID, type FighterId, type FighterSpec, fighterById, pickOpponent } from "./roster";
import type {
  ArenaHud,
  AttackKind,
  FighterHud,
  GameMode,
  HudState,
  InputAction,
  RoundResult,
  StateListener,
} from "./types";

interface AttackState {
  kind: AttackKind;
  elapsed: number;
  didHit: boolean;
}

interface RuntimeFighter {
  spec: FighterSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  blocking: boolean;
  hurt: number;
  cooldown: number;
  attack: AttackState | null;
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  // Arena-only bookkeeping (left at defaults for duel fighters).
  slot: number;
  isPlayer: boolean;
  isBot: boolean;
  damage: number;
  stocks: number;
  eliminated: boolean;
  respawn: number;
  prevY: number;
  grounded: boolean;
  airJumpUsed: boolean;
}

interface Spark {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

interface FighterDebug {
  slot: number;
  id: FighterId;
  x: number;
  y: number;
  stocks: number;
  damage: number;
  eliminated: boolean;
  isPlayer: boolean;
  respawn: number;
}

const KEY_ACTIONS: Record<string, InputAction> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "jump",
  ArrowUp: "jump",
  Space: "jump",
  KeyS: "guard",
  ArrowDown: "guard",
  ShiftLeft: "guard",
  ShiftRight: "guard",
  KeyJ: "light",
  KeyK: "heavy",
  KeyL: "special",
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 100);
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly held = new Set<InputAction>();
  private readonly virtualHeld = new Set<InputAction>();
  private readonly sparks: Spark[] = [];

  private raf = 0;
  private disposed = false;
  private mode: GameMode = "duel";
  private selectedId: FighterId = DEFAULT_PLAYER_ID;
  private arenaSlots: number = ARENA_RULES.defaultSlots;
  private opponentId: FighterId | null = null;
  private player: RuntimeFighter | null = null;
  private opponent: RuntimeFighter | null = null;
  private arenaFighters: RuntimeFighter[] = [];
  private lastArenaStanding: RuntimeFighter | null = null;
  private status: HudState["status"] = "select";
  private result: RoundResult | null = null;
  private timer: number = ARENA.roundSeconds;
  private hits = 0;
  private emitAccumulator = 0;
  private attackQueue: AttackKind | null = null;
  private jumpQueued = false;
  private shake = 0;
  private lastFrame = performance.now();
  private roundStartedAt = 0;
  private resultRecorded = false;
  private audioContext: AudioContext | null = null;
  private camX = 0;
  private camY = 0;
  private viewHalfW = 16;
  private viewHalfH = 9;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly listener: StateListener,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color("#07080b");
    this.camera.position.set(0, 0, 24);
    this.camera.lookAt(0, 0, 0);
    this.buildStage();
    this.bindEvents();
    this.resize();
    this.emit();
  }

  start() {
    if (this.raf) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  setMode(mode: GameMode) {
    this.mode = mode;
    if (this.status !== "playing") {
      this.status = "select";
      this.result = null;
      this.opponentId = null;
      this.timer = ARENA.roundSeconds;
      this.clearFighters();
    }
    this.emit();
  }

  setArenaSlots(slots: number) {
    this.arenaSlots = clampSlots(slots);
    this.emit();
  }

  selectFighter(id: FighterId) {
    this.selectedId = id;
    if (this.status !== "playing") {
      this.status = "select";
      this.result = null;
      this.opponentId = null;
      this.timer = ARENA.roundSeconds;
      this.clearFighters();
    }
    this.emit();
  }

  startFight(id: FighterId = this.selectedId) {
    this.unlockAudio();
    this.mode = "duel";
    this.selectedId = id;
    this.opponentId = pickOpponent(id);
    this.clearFighters();
    this.player = this.createFighter(fighterById(id), -4.9, 1, { slot: 0, isPlayer: true });
    this.opponent = this.createFighter(fighterById(this.opponentId), 4.9, -1, { slot: 1, isBot: true });
    this.status = "playing";
    this.result = null;
    this.timer = ARENA.roundSeconds;
    this.hits = 0;
    this.resultRecorded = false;
    this.roundStartedAt = performance.now();
    this.camX = 0;
    this.camY = 0;
    this.tone(180, 0.08, "sawtooth");
    this.emit();
  }

  startArena(id: FighterId = this.selectedId, slots: number = this.arenaSlots) {
    this.unlockAudio();
    this.mode = "arena";
    this.selectedId = id;
    this.arenaSlots = clampSlots(slots);
    this.opponentId = null;
    this.clearFighters();
    const lineup = chooseArenaRoster(id, this.arenaSlots);
    this.arenaFighters = lineup.map((fighterId, index) => {
      const spec = fighterById(fighterId);
      const x = ARENA_RULES.spawnPoints[index] ?? 0;
      const facing: 1 | -1 = x <= 0 ? 1 : -1;
      return this.createFighter(spec, x, facing, {
        slot: index,
        isPlayer: index === 0,
        isBot: index !== 0,
        stocks: ARENA_RULES.stocks,
      });
    });
    this.lastArenaStanding = this.arenaFighters[0] ?? null;
    this.status = "playing";
    this.result = null;
    this.timer = ARENA.roundSeconds;
    this.hits = 0;
    this.resultRecorded = false;
    this.roundStartedAt = performance.now();
    this.camX = 0;
    this.camY = 0;
    this.tone(170, 0.08, "sawtooth");
    this.emit();
  }

  rematch() {
    if (this.mode === "arena") this.startArena(this.selectedId, this.arenaSlots);
    else this.startFight(this.selectedId);
  }

  command(action: InputAction) {
    if (action === "jump") {
      this.jumpQueued = true;
      return;
    }
    if (action === "light" || action === "heavy" || action === "special") {
      this.attackQueue = action;
    }
  }

  setVirtual(action: InputAction, pressed: boolean) {
    if (pressed) this.virtualHeld.add(action);
    else this.virtualHeld.delete(action);
  }

  debugSnapshot(): HudState & {
    playerX: number | null;
    opponentX: number | null;
    arenaFighters: FighterDebug[];
  } {
    return {
      ...this.hudState(),
      playerX: this.mode === "arena" ? (this.arenaFighters[0]?.x ?? null) : (this.player?.x ?? null),
      opponentX: this.opponent?.x ?? null,
      arenaFighters: this.arenaFighters.map((fighter) => ({
        slot: fighter.slot,
        id: fighter.spec.id,
        x: fighter.x,
        y: fighter.y,
        stocks: fighter.stocks,
        damage: Math.round(fighter.damage),
        eliminated: fighter.eliminated,
        isPlayer: fighter.isPlayer,
        respawn: fighter.respawn,
      })),
    };
  }

  /** Test hook: shove an arena fighter past the blast zone to force a ring-out. */
  debugRingOut(slot: number) {
    const fighter = this.arenaFighters[slot];
    if (!fighter || fighter.eliminated) return;
    fighter.x = ARENA_RULES.blast.right + 6;
    fighter.vx = 0;
    fighter.vy = 0;
    // Clear respawn invulnerability so a chain of ring-outs can be driven from a
    // test without waiting out the intangibility window each life.
    fighter.respawn = 0;
  }

  /** Test hook: jump the round clock (e.g. to force a time-out finish). */
  debugSetTimer(seconds: number) {
    this.timer = Math.max(0, seconds);
  }

  /** Test hook: drop every rival to their last life and ring them out. */
  debugEliminateRivals() {
    for (const fighter of this.arenaFighters) {
      if (fighter.isPlayer || fighter.eliminated) continue;
      fighter.stocks = 1;
      fighter.x = ARENA_RULES.blast.right + 6;
      fighter.vx = 0;
      fighter.vy = 0;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.clearFighters();
    for (const spark of this.sparks.splice(0)) {
      this.scene.remove(spark.mesh);
      spark.mesh.geometry.dispose();
      if (Array.isArray(spark.mesh.material)) {
        for (const material of spark.mesh.material) material.dispose();
      } else {
        spark.mesh.material.dispose();
      }
    }
    this.renderer.dispose();
  }

  private readonly loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    if (this.status === "playing") {
      if (this.mode === "arena") this.updateArena(delta);
      else this.updateDuel(delta);
    }
    this.updateSparks(delta);
    this.updateCamera(delta);
    this.render();
    this.emitAccumulator += delta;
    if (this.emitAccumulator >= 0.06) {
      this.emitAccumulator = 0;
      this.emit();
    }
  };

  // --- Duel mode (1v1, health-based KO) -----------------------------------

  private updateDuel(delta: number) {
    if (!this.player || !this.opponent) return;
    this.timer = Math.max(0, this.timer - delta);
    this.updatePlayerInput();
    this.updateAi(delta);
    this.updateFighter(this.player, delta);
    this.updateFighter(this.opponent, delta);
    this.resolveSpacing();
    this.updateAttack(this.player, this.opponent, delta);
    this.updateAttack(this.opponent, this.player, delta);
    this.applyTransforms();
    if (this.player.health <= 0) this.finishRound(this.opponent, this.player, "ko");
    else if (this.opponent.health <= 0) this.finishRound(this.player, this.opponent, "ko");
    else if (this.timer <= 0) {
      const winner = this.player.health >= this.opponent.health ? this.player : this.opponent;
      const loser = winner === this.player ? this.opponent : this.player;
      this.finishRound(winner, loser, "time");
    }
  }

  private updatePlayerInput() {
    const player = this.player;
    if (!player || player.hurt > 0) return;
    const axis = (this.isHeld("right") ? 1 : 0) - (this.isHeld("left") ? 1 : 0);
    player.blocking = this.isHeld("guard") && player.y <= 0.01 && !player.attack;
    player.vx = player.blocking ? 0 : axis * player.spec.speed;
    if (axis !== 0) player.facing = axis > 0 ? 1 : -1;
    if (this.jumpQueued && player.y <= 0.01 && !player.blocking) {
      player.vy = player.spec.jump;
      this.tone(270, 0.05, "triangle");
    }
    this.jumpQueued = false;
    const queued = this.attackQueue;
    this.attackQueue = null;
    if (queued) this.startAttack(player, queued);
  }

  private updateAi(delta: number) {
    if (!this.player || !this.opponent || this.opponent.hurt > 0) return;
    const opponent = this.opponent;
    const distance = Math.abs(this.player.x - opponent.x);
    opponent.facing = this.player.x >= opponent.x ? 1 : -1;
    opponent.cooldown = Math.max(0, opponent.cooldown - delta);
    const playerThreat = Boolean(this.player.attack && distance < 2.8);
    opponent.blocking = playerThreat && opponent.y <= 0.01 && opponent.cooldown <= 0.18;
    if (opponent.blocking) {
      opponent.vx = 0;
      return;
    }
    const desired = opponent.spec.id === "trucebreaker" ? 2.05 : 1.7;
    opponent.vx = distance > desired ? Math.sign(this.player.x - opponent.x) * opponent.spec.speed * 0.82 : 0;
    if (distance <= 2.7 && opponent.cooldown <= 0 && !opponent.attack) {
      const pressure = this.timer % 7;
      const kind: AttackKind = pressure < 1.3 ? "special" : pressure < 3.8 ? "heavy" : "light";
      this.startAttack(opponent, kind);
    }
  }

  private updateFighter(fighter: RuntimeFighter, delta: number) {
    fighter.cooldown = Math.max(0, fighter.cooldown - delta);
    fighter.hurt = Math.max(0, fighter.hurt - delta);
    fighter.x += fighter.vx * delta;
    fighter.x = Math.max(-ARENA.halfWidth, Math.min(ARENA.halfWidth, fighter.x));
    fighter.vy -= ARENA.gravity * delta;
    fighter.y += fighter.vy * delta;
    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
    }
  }

  private updateAttack(attacker: RuntimeFighter, target: RuntimeFighter, delta: number) {
    const attack = attacker.attack;
    if (!attack) return;
    const spec = ATTACKS[attack.kind];
    attack.elapsed += delta;
    if (!attack.didHit && attack.elapsed >= spec.windup) {
      attack.didHit = true;
      const horizontalDistance = Math.abs(attacker.x - target.x);
      const verticalDistance = Math.abs(attacker.y - target.y);
      const facingTarget = Math.sign(target.x - attacker.x) === attacker.facing || horizontalDistance < 0.25;
      if (horizontalDistance <= spec.range && verticalDistance <= 1.5 && facingTarget) {
        const raw = attackDamage(attack.kind, attacker.spec);
        const damage = guardedDamage(raw, target.blocking);
        target.health = Math.max(0, target.health - damage);
        target.hurt = target.blocking ? 0.08 : 0.18;
        target.vx += attacker.facing * spec.push * (target.blocking ? 0.35 : 1);
        this.shake = Math.max(this.shake, spec.shake);
        if (attacker === this.player) this.hits += 1;
        this.spawnSparks(target.x, ARENA.groundY + 1.75 + target.y, target.blocking ? "#70d6ff" : attacker.spec.tint);
        this.tone(target.blocking ? 160 : 90 + raw * 10, target.blocking ? 0.04 : 0.07, "square");
      } else {
        this.tone(90, 0.03, "triangle");
      }
    }
    if (attack.elapsed >= spec.duration) attacker.attack = null;
  }

  private finishRound(winner: RuntimeFighter, loser: RuntimeFighter, reason: RoundResult["reason"]) {
    if (this.status !== "playing") return;
    this.status = "round-over";
    const outcome = winner === this.player ? "victory" : "defeat";
    this.result = {
      outcome,
      winnerName: winner.spec.name,
      loserName: loser.spec.name,
      reason,
    };
    this.shake = Math.max(this.shake, 0.6);
    this.spawnSparks(loser.x, ARENA.groundY + 1.9 + loser.y, outcome === "victory" ? "#ff7a1a" : "#9fe22e", 18);
    this.tone(outcome === "victory" ? 380 : 70, 0.18, outcome === "victory" ? "sawtooth" : "square");
    this.recordOutcome(outcome, winner.health / winner.spec.maxHealth, loser.spec.faction === "Scourge");
    this.emit();
  }

  private resolveSpacing() {
    if (!this.player || !this.opponent) return;
    const gap = this.opponent.x - this.player.x;
    const overlap = ARENA.minSpacing - Math.abs(gap);
    if (overlap <= 0) return;
    const direction = gap >= 0 ? 1 : -1;
    this.player.x -= (overlap * direction) / 2;
    this.opponent.x += (overlap * direction) / 2;
  }

  private applyTransforms() {
    if (!this.player || !this.opponent) return;
    this.player.facing = this.opponent.x >= this.player.x ? 1 : -1;
    this.opponent.facing = this.player.x >= this.opponent.x ? 1 : -1;
    this.transformFighter(this.player);
    this.transformFighter(this.opponent);
  }

  // --- Arena mode (2-4 fighters, damage% knockback + ring-out + stocks) -----

  private updateArena(delta: number) {
    if (this.arenaFighters.length === 0) return;
    this.timer = Math.max(0, this.timer - delta);
    const player = this.arenaFighters[0];
    if (player) this.updateArenaPlayer(player);
    for (const fighter of this.arenaFighters) {
      if (fighter.isBot) this.updateArenaBot(fighter);
    }
    for (const fighter of this.arenaFighters) this.updateArenaPhysics(fighter, delta);
    this.resolveArenaSpacing();
    // Track who has been launched this frame so a second simultaneous hit keeps
    // the stronger launch instead of overwriting it with a weaker one.
    const launchedThisFrame = new Set<RuntimeFighter>();
    for (const fighter of this.arenaFighters) this.updateArenaAttack(fighter, delta, launchedThisFrame);
    for (const fighter of this.arenaFighters) {
      if (!fighter.eliminated) this.transformFighter(fighter);
    }
    this.resolveArenaRingouts();
    const alive = this.arenaFighters.filter((fighter) => !fighter.eliminated);
    if (alive.length === 1) this.lastArenaStanding = alive[0] ?? this.lastArenaStanding;
    if (alive.length <= 1) {
      const winner = alive[0] ?? this.lastArenaStanding ?? rankArena(this.arenaFighters)[0] ?? null;
      this.finishArena(winner, "last-standing");
      return;
    }
    if (this.timer <= 0) {
      const winner = rankArena(this.arenaFighters)[0] ?? null;
      this.finishArena(winner, "time");
    }
  }

  private updateArenaPlayer(player: RuntimeFighter) {
    if (player.eliminated || player.hurt > 0) return;
    const axis = (this.isHeld("right") ? 1 : 0) - (this.isHeld("left") ? 1 : 0);
    player.blocking = this.isHeld("guard") && player.grounded && !player.attack;
    const authority = player.grounded ? 1 : 0.86;
    player.vx = player.blocking ? 0 : axis * player.spec.speed * authority;
    if (axis !== 0) player.facing = axis > 0 ? 1 : -1;
    if (this.jumpQueued && !player.blocking && (player.grounded || !player.airJumpUsed)) {
      player.vy = player.spec.jump * (player.grounded ? 1 : 0.92);
      if (!player.grounded) player.airJumpUsed = true;
      this.tone(270, 0.05, "triangle");
    }
    this.jumpQueued = false;
    const queued = this.attackQueue;
    this.attackQueue = null;
    if (queued) this.startAttack(player, queued);
  }

  private updateArenaBot(bot: RuntimeFighter) {
    if (bot.eliminated || bot.hurt > 0) return;
    const target = nearestTarget(
      bot,
      this.arenaFighters.filter((other) => other !== bot),
    );
    if (!target) {
      bot.vx = 0;
      return;
    }
    // Recover toward the stage when knocked over the void.
    if (isOverVoid(bot.x)) {
      const dir = recoveryDir(bot.x);
      bot.vx = dir * bot.spec.speed * 0.95;
      bot.facing = dir;
      if (!bot.grounded && !bot.airJumpUsed && bot.vy <= 0) {
        bot.vy = bot.spec.jump;
        bot.airJumpUsed = true;
      }
      return;
    }
    const dx = target.x - bot.x;
    const distance = Math.abs(dx);
    bot.facing = dx >= 0 ? 1 : -1;
    const threat = this.arenaFighters.some(
      (other) =>
        other !== bot &&
        !other.eliminated &&
        other.attack !== null &&
        Math.abs(other.x - bot.x) < 2.6 &&
        Math.abs(other.y - bot.y) < 1.6,
    );
    bot.blocking = threat && bot.grounded && bot.cooldown <= 0.2;
    if (bot.blocking) {
      bot.vx = 0;
      return;
    }
    const desired = bot.spec.id === "trucebreaker" ? 2.0 : 1.7;
    let dir = distance > desired ? Math.sign(dx) : 0;
    if (wouldStepOffEdge(bot.x, dir)) dir = 0;
    bot.vx = dir * bot.spec.speed * 0.84;
    if (target.y - bot.y > 1.4 && bot.grounded) {
      bot.vy = bot.spec.jump;
    }
    if (distance <= 2.6 && Math.abs(target.y - bot.y) <= 1.5 && bot.cooldown <= 0 && !bot.attack) {
      const variety = (Math.floor(this.timer * 3) + bot.slot) % 7;
      const kind: AttackKind = variety < 1 ? "special" : variety < 3 ? "heavy" : "light";
      this.startAttack(bot, kind);
    }
  }

  private updateArenaPhysics(fighter: RuntimeFighter, delta: number) {
    if (fighter.eliminated) return;
    fighter.cooldown = Math.max(0, fighter.cooldown - delta);
    fighter.hurt = Math.max(0, fighter.hurt - delta);
    if (fighter.respawn > 0) fighter.respawn = Math.max(0, fighter.respawn - delta);
    fighter.prevY = fighter.y;
    fighter.x += fighter.vx * delta;
    fighter.vy -= ARENA.gravity * delta;
    fighter.y += fighter.vy * delta;
    const support = resolveSupport({ prevY: fighter.prevY, y: fighter.y, vy: fighter.vy, x: fighter.x });
    fighter.y = support.y;
    fighter.vy = support.vy;
    fighter.grounded = support.grounded;
    if (fighter.grounded) fighter.airJumpUsed = false;
    const drag = fighter.grounded ? ARENA_RULES.groundDrag : ARENA_RULES.airDrag;
    fighter.vx *= Math.exp(-drag * delta);
  }

  private updateArenaAttack(attacker: RuntimeFighter, delta: number, launchedThisFrame: Set<RuntimeFighter>) {
    const attack = attacker.attack;
    if (!attack || attacker.eliminated) return;
    const spec = ATTACKS[attack.kind];
    attack.elapsed += delta;
    if (!attack.didHit && attack.elapsed >= spec.windup) {
      attack.didHit = true;
      let landed = false;
      for (const target of this.arenaFighters) {
        if (target === attacker || target.eliminated || target.respawn > 0) continue;
        const horizontalDistance = Math.abs(attacker.x - target.x);
        const verticalDistance = Math.abs(attacker.y - target.y);
        const facingTarget = Math.sign(target.x - attacker.x) === attacker.facing || horizontalDistance < 0.25;
        if (horizontalDistance > spec.range || verticalDistance > 1.5 || !facingTarget) continue;
        const raw = attackDamage(attack.kind, attacker.spec);
        const damage = guardedDamage(raw, target.blocking);
        target.damage += damage;
        const launch = knockback({
          basePush: spec.push,
          damagePercent: target.damage,
          weight: fighterWeight(target.spec.maxHealth),
          facing: attacker.facing,
          launch: target.blocking ? 0 : launchBonus(attack.kind),
        });
        const mult = target.blocking ? 0.32 : 1;
        const next = { vx: launch.vx * mult, vy: launch.vy * mult };
        const applied = launchedThisFrame.has(target) ? strongerLaunch({ vx: target.vx, vy: target.vy }, next) : next;
        target.vx = applied.vx;
        target.vy = applied.vy;
        target.grounded = false;
        launchedThisFrame.add(target);
        target.hurt = target.blocking ? 0.12 : 0.26;
        this.shake = Math.max(this.shake, spec.shake);
        if (attacker.isPlayer) this.hits += 1;
        this.spawnSparks(target.x, ARENA.groundY + 1.75 + target.y, target.blocking ? "#70d6ff" : attacker.spec.tint);
        this.tone(target.blocking ? 160 : 90 + raw * 10, target.blocking ? 0.04 : 0.07, "square");
        landed = true;
      }
      if (!landed) this.tone(90, 0.03, "triangle");
    }
    if (attack.elapsed >= spec.duration) attacker.attack = null;
  }

  private resolveArenaSpacing() {
    const fighters = this.arenaFighters;
    for (let i = 0; i < fighters.length; i += 1) {
      const a = fighters[i];
      if (!a || a.eliminated) continue;
      for (let j = i + 1; j < fighters.length; j += 1) {
        const b = fighters[j];
        if (!b || b.eliminated) continue;
        if (Math.abs(a.y - b.y) > 1.6) continue;
        const gap = b.x - a.x;
        const overlap = ARENA.minSpacing - Math.abs(gap);
        if (overlap <= 0) continue;
        const direction = gap >= 0 ? 1 : -1;
        a.x -= (overlap * direction) / 2;
        b.x += (overlap * direction) / 2;
      }
    }
  }

  private resolveArenaRingouts() {
    for (const fighter of this.arenaFighters) {
      if (fighter.eliminated || fighter.respawn > 0) continue;
      if (!isRingOut(fighter.x, fighter.y)) continue;
      fighter.stocks -= 1;
      this.shake = Math.max(this.shake, 0.5);
      const fx = Math.max(ARENA_RULES.blast.left, Math.min(ARENA_RULES.blast.right, fighter.x));
      const fy = Math.max(-6, Math.min(8, fighter.y));
      this.spawnSparks(fx, ARENA.groundY + 2 + fy, fighter.spec.tint, 16);
      this.tone(70, 0.16, "square");
      if (fighter.stocks > 0) {
        fighter.x = ARENA_RULES.respawn.x;
        fighter.y = ARENA_RULES.respawn.y;
        fighter.prevY = fighter.y;
        fighter.vx = 0;
        fighter.vy = 0;
        fighter.damage = 0;
        fighter.hurt = 0;
        fighter.cooldown = 0;
        fighter.attack = null;
        fighter.blocking = false;
        fighter.grounded = false;
        fighter.airJumpUsed = false;
        fighter.respawn = ARENA_RULES.respawnInvuln;
      } else {
        fighter.eliminated = true;
        fighter.sprite.visible = false;
        fighter.shadow.visible = false;
      }
    }
  }

  private finishArena(winner: RuntimeFighter | null, reason: RoundResult["reason"]) {
    if (this.status !== "playing") return;
    this.status = "round-over";
    const player = this.arenaFighters[0] ?? null;
    const outcome = winner?.isPlayer ? "victory" : "defeat";
    this.result = {
      outcome,
      winnerName: winner ? winner.spec.name : "No one",
      loserName: outcome === "victory" ? "the field" : (winner?.spec.name ?? "the field"),
      reason,
    };
    this.shake = Math.max(this.shake, 0.7);
    if (winner) {
      this.spawnSparks(
        Math.max(-6, Math.min(6, winner.x)),
        ARENA.groundY + 2.2 + Math.max(0, winner.y),
        outcome === "victory" ? "#ff7a1a" : "#9fe22e",
        22,
      );
    }
    this.tone(outcome === "victory" ? 380 : 70, 0.2, outcome === "victory" ? "sawtooth" : "square");
    const ranked = rankArena(this.arenaFighters);
    const place = player ? ranked.indexOf(player) : ranked.length - 1;
    const survivalBonus = player ? Math.max(0, player.stocks) * 180 : 0;
    const placeBonus = Math.max(0, this.arenaFighters.length - 1 - place) * 120;
    const score = Math.round((outcome === "victory" ? 700 : 200) + survivalBonus + placeBonus + this.hits * 20);
    const bossKill =
      outcome === "victory" && this.arenaFighters.some((f) => f.eliminated && f.spec.faction === "Scourge");
    this.recordArenaOutcome(outcome, score, bossKill);
    this.emit();
  }

  private recordOutcome(outcome: "victory" | "defeat", healthRatio: number, bossKill: boolean) {
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    const duration = Math.max(1, performance.now() - this.roundStartedAt);
    const score = Math.round(healthRatio * 500 + this.timer * 10 + this.hits * 25);
    recordWarResult("brawl", { outcome, score, timeMs: duration, bossKill }, Date.now());
    void reportWarlineOperation("brawl", { outcome, score });
  }

  private recordArenaOutcome(outcome: "victory" | "defeat", score: number, bossKill: boolean) {
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    const duration = Math.max(1, performance.now() - this.roundStartedAt);
    recordWarResult("brawl", { outcome, score, timeMs: duration, bossKill }, Date.now());
    void reportWarlineOperation("brawl", { outcome, score });
  }

  // --- Shared rendering / fighters / FX -----------------------------------

  private startAttack(fighter: RuntimeFighter, kind: AttackKind) {
    if (this.status !== "playing" || fighter.cooldown > 0 || fighter.attack || fighter.blocking || fighter.hurt > 0) {
      return;
    }
    const spec = ATTACKS[kind];
    fighter.attack = { kind, elapsed: 0, didHit: false };
    fighter.cooldown = spec.cooldown;
  }

  private transformFighter(fighter: RuntimeFighter) {
    const height = ARENA.fighterHeight * fighter.spec.scale;
    const width = ARENA.fighterWidth * fighter.spec.scale;
    const attackLean = fighter.attack ? fighter.facing * 0.22 : 0;
    const hurtLean = fighter.hurt > 0 ? -fighter.facing * 0.16 : 0;
    fighter.sprite.position.set(fighter.x + attackLean + hurtLean, ARENA.groundY + height / 2 + fighter.y, 2);
    fighter.sprite.scale.set(width * fighter.facing, height, 1);
    fighter.shadow.position.set(fighter.x, ARENA.groundY + 0.06, 1);
    fighter.shadow.scale.set(1.25 * fighter.spec.scale, 0.22, 1);
    const material = fighter.sprite.material;
    if (fighter.respawn > 0) {
      material.opacity = Math.floor(fighter.respawn * 18) % 2 === 0 ? 0.45 : 0.95;
    } else {
      material.opacity = fighter.hurt > 0 && Math.floor(fighter.hurt * 40) % 2 === 0 ? 0.55 : 1;
    }
    material.color.set(fighter.blocking ? "#b7ecff" : "#ffffff");
  }

  private updateCamera(delta: number) {
    let focus = { x: 0, y: 0 };
    if (this.mode === "arena" && this.status !== "select") {
      const alive = this.arenaFighters.filter((fighter) => !fighter.eliminated);
      if (alive.length > 0) focus = arenaCameraFocus(alive);
    }
    const lerp = 1 - Math.exp(-ARENA_RULES.camera.lerp * delta);
    this.camX += (focus.x - this.camX) * lerp;
    this.camY += (focus.y - this.camY) * lerp;
  }

  private render() {
    const zoom = this.mode === "arena" ? ARENA_RULES.camera.zoom : 1;
    const halfW = this.viewHalfW * zoom;
    const halfH = this.viewHalfH * zoom;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.45 : 0;
    this.shake = Math.max(0, this.shake - 0.035);
    this.camera.position.x = this.camX + shakeX;
    this.camera.position.y = this.camY + shakeY;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private createFighter(
    spec: FighterSpec,
    x: number,
    facing: 1 | -1,
    options: { slot?: number; isPlayer?: boolean; isBot?: boolean; stocks?: number } = {},
  ): RuntimeFighter {
    const texture = this.textureLoader.load(spec.spriteUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32 }),
    );
    this.scene.add(shadow, sprite);
    const fighter: RuntimeFighter = {
      spec,
      x,
      y: 0,
      vx: 0,
      vy: 0,
      facing,
      health: spec.maxHealth,
      blocking: false,
      hurt: 0,
      cooldown: 0,
      attack: null,
      sprite,
      shadow,
      slot: options.slot ?? 0,
      isPlayer: options.isPlayer ?? false,
      isBot: options.isBot ?? false,
      damage: 0,
      stocks: options.stocks ?? 0,
      eliminated: false,
      respawn: 0,
      prevY: 0,
      grounded: true,
      airJumpUsed: false,
    };
    this.transformFighter(fighter);
    return fighter;
  }

  private clearFighters() {
    const all: (RuntimeFighter | null)[] = [this.player, this.opponent, ...this.arenaFighters];
    for (const fighter of all) {
      if (!fighter) continue;
      this.scene.remove(fighter.sprite, fighter.shadow);
      fighter.sprite.material.map?.dispose();
      fighter.sprite.material.dispose();
      fighter.shadow.geometry.dispose();
      if (Array.isArray(fighter.shadow.material)) {
        for (const material of fighter.shadow.material) material.dispose();
      } else {
        fighter.shadow.material.dispose();
      }
    }
    this.player = null;
    this.opponent = null;
    this.arenaFighters = [];
    this.lastArenaStanding = null;
  }

  private buildStage() {
    const addPlane = (width: number, height: number, x: number, y: number, z: number, color: string, opacity = 1) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    };

    addPlane(40, 18, 0, 0, -7, "#08090e");
    addPlane(34, 6.2, 0, -0.4, -6, "#12151d");
    addPlane(28, 1.2, 0, ARENA.groundY - 0.6, -3, "#23242b");
    addPlane(27.4, 0.1, 0, ARENA.groundY + 0.04, -2, "#e8dcc8", 0.72);
    addPlane(4.2, 7, -11.8, -0.5, -5, "#351613", 0.62);
    addPlane(4.2, 7, 11.8, -0.5, -5, "#123022", 0.62);
    for (let i = -5; i <= 5; i += 1) {
      addPlane(0.045, 1.45, i * 2, ARENA.groundY - 0.16, -1, i === 0 ? "#ff7a1a" : "#4a4b52", 0.54);
    }
    this.buildArenaPlatforms(addPlane);
  }

  // Faint markers for the Arena ledges + one-way platforms. They share the duel
  // stage so the geometry only "means" something while the arena ruleset runs,
  // but drawing them always keeps the scene graph static and cheap.
  private buildArenaPlatforms(
    addPlane: (w: number, h: number, x: number, y: number, z: number, color: string, opacity?: number) => THREE.Mesh,
  ) {
    const main = ARENA_RULES.platform;
    // Ledge posts mark where the solid platform ends and the void begins.
    addPlane(0.16, 2.4, main.left, ARENA.groundY - 0.5, -1, "#c1121f", 0.4);
    addPlane(0.16, 2.4, main.right, ARENA.groundY - 0.5, -1, "#c1121f", 0.4);
    for (const side of ARENA_RULES.sidePlatforms) {
      const width = side.right - side.left;
      const cx = (side.left + side.right) / 2;
      addPlane(width, 0.32, cx, ARENA.groundY + side.top, -1.5, "#2c3340", 0.55);
      addPlane(width, 0.08, cx, ARENA.groundY + side.top + 0.16, -1.5, "#8bdc1f", 0.4);
    }
  }

  private spawnSparks(x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.set(x, y, 5);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      this.sparks.push({
        mesh,
        life: 0.28 + Math.random() * 0.16,
        maxLife: 0.44,
        vx: Math.cos(angle) * (1.4 + Math.random() * 3.2),
        vy: Math.sin(angle) * (1.4 + Math.random() * 2.5),
      });
      this.scene.add(mesh);
    }
  }

  private updateSparks(delta: number) {
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      if (!spark) continue;
      spark.life -= delta;
      spark.mesh.position.x += spark.vx * delta;
      spark.mesh.position.y += spark.vy * delta;
      spark.mesh.rotation.z += delta * 8;
      const material = spark.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, spark.life / spark.maxLife);
      if (spark.life <= 0) {
        this.scene.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        material.dispose();
        this.sparks.splice(i, 1);
      }
    }
  }

  private hudState(): HudState {
    return {
      status: this.status,
      mode: this.mode,
      selectedId: this.selectedId,
      arenaSlots: this.arenaSlots,
      opponentId: this.opponentId,
      timer: Math.ceil(this.timer),
      player: this.mode === "duel" && this.player ? this.fighterHud(this.player) : null,
      opponent: this.mode === "duel" && this.opponent ? this.fighterHud(this.opponent) : null,
      arena: this.mode === "arena" ? this.arenaHud() : null,
      result: this.result,
      hits: this.hits,
    };
  }

  private arenaHud(): ArenaHud {
    return {
      slots: this.arenaSlots,
      fighters: this.arenaFighters.map((fighter) => ({
        slot: fighter.slot,
        id: fighter.spec.id,
        name: fighter.spec.name,
        faction: fighter.spec.faction,
        damage: Math.round(fighter.damage),
        stocks: fighter.stocks,
        eliminated: fighter.eliminated,
        isPlayer: fighter.isPlayer,
        blocking: fighter.blocking,
        attacking: fighter.attack?.kind ?? null,
      })),
      alive: aliveCount(this.arenaFighters),
      winnerName: this.result ? this.result.winnerName : null,
    };
  }

  private fighterHud(fighter: RuntimeFighter): FighterHud {
    return {
      id: fighter.spec.id,
      name: fighter.spec.name,
      faction: fighter.spec.faction,
      health: Math.max(0, Math.round(fighter.health)),
      maxHealth: fighter.spec.maxHealth,
      blocking: fighter.blocking,
      attacking: fighter.attack?.kind ?? null,
    };
  }

  private emit() {
    this.listener(this.hudState());
  }

  private isHeld(action: InputAction): boolean {
    return this.held.has(action) || this.virtualHeld.has(action);
  }

  private bindEvents() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    if (action === "jump" && !this.held.has("jump")) this.jumpQueued = true;
    if (action === "light" || action === "heavy" || action === "special") this.attackQueue = action;
    else this.held.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    this.held.delete(action);
  };

  private readonly resize = () => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    const visibleHeight = 12;
    const visibleWidth = visibleHeight * (width / height);
    this.viewHalfH = visibleHeight / 2;
    this.viewHalfW = visibleWidth / 2;
    this.camera.left = -this.viewHalfW;
    this.camera.right = this.viewHalfW;
    this.camera.top = this.viewHalfH;
    this.camera.bottom = -this.viewHalfH;
    this.camera.updateProjectionMatrix();
  };

  private unlockAudio() {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") void this.audioContext.resume();
      return;
    }
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    this.audioContext = new AudioCtor();
  }

  private tone(frequency: number, duration: number, type: OscillatorType) {
    const ctx = this.audioContext;
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }
}
