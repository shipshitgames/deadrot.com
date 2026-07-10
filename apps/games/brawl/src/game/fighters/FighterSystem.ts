import { recordWarResult } from "@deadrot/game-kit/core";
import { reportWarlineOperation } from "@deadrot/game-kit/warline";
import {
  ARENA_RULES,
  aliveCount,
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
} from "../arena";
import { ATTACKS, attackDamage, guardedDamage } from "../combat";
import { ARENA, MAP } from "../constants";
import type { InputSystem } from "../input/InputSystem";
import { DEFAULT_PLAYER_ID, type FighterId, type FighterSpec, fighterById, pickOpponent } from "../roster";
import type { BrawlAudioPort, FighterDebug, FighterRenderPort, RuntimeFighter } from "../runtime";
import type { ArenaHud, AttackKind, FighterHud, GameMode, HudState, RoundResult, StateListener } from "../types";

export class FighterSystem {
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
  private roundStartedAt = 0;
  private resultRecorded = false;

  constructor(
    private readonly render: FighterRenderPort,
    private readonly input: InputSystem,
    private readonly audio: BrawlAudioPort,
    private readonly listener: StateListener,
  ) {
    this.emit();
  }

  get currentMode() {
    return this.mode;
  }

  get currentStatus() {
    return this.status;
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
    this.audio.unlock();
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
    this.input.clear();
    this.audio.roundStart("duel");
    this.emit();
  }

  startArena(id: FighterId = this.selectedId, slots: number = this.arenaSlots) {
    this.audio.unlock();
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
    this.input.clear();
    this.audio.roundStart("arena");
    this.emit();
  }

  rematch() {
    if (this.mode === "arena") this.startArena(this.selectedId, this.arenaSlots);
    else this.startFight(this.selectedId);
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.input.clear();
    this.emit();
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "playing";
    this.input.clear();
    this.emit();
  }

  togglePause() {
    if (this.status === "playing") this.pause();
    else if (this.status === "paused") this.resume();
  }

  returnToRoster() {
    this.status = "select";
    this.result = null;
    this.opponentId = null;
    this.timer = ARENA.roundSeconds;
    this.hits = 0;
    this.resultRecorded = false;
    this.input.clear();
    this.clearFighters();
    this.emit();
  }

  debugSnapshot(): HudState & {
    playerX: number | null;
    opponentX: number | null;
    arenaFighters: FighterDebug[];
    map: typeof MAP;
  } {
    return {
      ...this.snapshot(),
      // Canon map identity (apps/lore/content/Maps.md) — the join key the
      // War-for-the-Lanes registry uses to tie Brawl to its place.
      map: MAP,
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

  /** Test hook: put duel fighters at an exact spacing for combat transitions. */
  debugSetDuelPositions(playerX: number, opponentX: number) {
    if (!this.player || !this.opponent) return;
    this.player.x = playerX;
    this.opponent.x = opponentX;
    this.player.vx = 0;
    this.opponent.vx = 0;
    this.render.transformFighter(this.player);
    this.render.transformFighter(this.opponent);
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

  arenaCameraPositions(): { x: number; y: number }[] {
    return this.arenaFighters
      .filter((fighter) => !fighter.eliminated)
      .map((fighter) => ({ x: fighter.x, y: fighter.y }));
  }

  emitSnapshot() {
    this.emit();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearFighters();
  }

  // --- Duel mode (1v1, health-based KO) -----------------------------------

  updateDuel(delta: number) {
    if (!this.player || !this.opponent) return;
    this.timer = Math.max(0, this.timer - delta);
    this.updatePlayerInput();
    this.updateAi();
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
    const axis = (this.input.isHeld("right") ? 1 : 0) - (this.input.isHeld("left") ? 1 : 0);
    player.blocking = this.input.isHeld("guard") && player.y <= 0.01 && !player.attack;
    player.vx = player.blocking ? 0 : axis * player.spec.speed;
    if (axis !== 0) player.facing = axis > 0 ? 1 : -1;
    if (this.input.consumeJump() && player.y <= 0.01 && !player.blocking) {
      player.vy = player.spec.jump;
      this.audio.jump();
    }
    const queued = this.input.consumeAttack();
    if (queued) this.startAttack(player, queued);
  }

  private updateAi() {
    if (!this.player || !this.opponent || this.opponent.hurt > 0) return;
    const opponent = this.opponent;
    const distance = Math.abs(this.player.x - opponent.x);
    opponent.facing = this.player.x >= opponent.x ? 1 : -1;
    // Cooldown is decremented once per frame in updateFighter (mirroring the
    // arena bot, which defers to updateArenaPhysics). updateAi must NOT decrement
    // it — doing so drained the opponent's cooldown at 2×, halving its attack
    // interval. (That removal is also why this method no longer needs `delta`.)
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
    // Captured before the decrement so it matches the hurt>0 check that made
    // updatePlayerInput/updateAi early-return (leaving vx unreset) this frame.
    const inHitstun = fighter.hurt > 0;
    fighter.hurt = Math.max(0, fighter.hurt - delta);
    fighter.x += fighter.vx * delta;
    fighter.x = Math.max(-ARENA.halfWidth, Math.min(ARENA.halfWidth, fighter.x));
    fighter.vy -= ARENA.gravity * delta;
    fighter.y += fighter.vy * delta;
    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
    }
    // During hitstun the input/AI steps don't refresh vx, so a fighter hit
    // mid-walk would glide at its stale walk speed. Damp horizontal velocity
    // (mirroring the arena path) so only the intended knockback carries through,
    // decaying smoothly instead of holding constant for the whole hurt window.
    if (inHitstun) {
      const drag = fighter.y <= 0.01 ? ARENA_RULES.groundDrag : ARENA_RULES.airDrag;
      fighter.vx *= Math.exp(-drag * delta);
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
        this.render.addShake(spec.shake);
        if (attacker === this.player) this.hits += 1;
        this.render.spawnSparks(
          target.x,
          ARENA.groundY + 1.75 + target.y,
          target.blocking ? "#70d6ff" : attacker.spec.tint,
        );
        this.audio.impact(target.blocking, raw);
      } else {
        this.audio.miss();
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
    this.render.addShake(0.6);
    this.render.spawnSparks(loser.x, ARENA.groundY + 1.9 + loser.y, outcome === "victory" ? "#ff7a1a" : "#9fe22e", 18);
    this.audio.roundEnd(outcome);
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
    this.render.transformFighter(this.player);
    this.render.transformFighter(this.opponent);
  }

  // --- Arena mode (2-4 fighters, damage% knockback + ring-out + stocks) -----

  updateArena(delta: number) {
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
      if (!fighter.eliminated) this.render.transformFighter(fighter);
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
    const axis = (this.input.isHeld("right") ? 1 : 0) - (this.input.isHeld("left") ? 1 : 0);
    player.blocking = this.input.isHeld("guard") && player.grounded && !player.attack;
    const authority = player.grounded ? 1 : 0.86;
    player.vx = player.blocking ? 0 : axis * player.spec.speed * authority;
    if (axis !== 0) player.facing = axis > 0 ? 1 : -1;
    if (this.input.consumeJump() && !player.blocking && (player.grounded || !player.airJumpUsed)) {
      player.vy = player.spec.jump * (player.grounded ? 1 : 0.92);
      if (!player.grounded) player.airJumpUsed = true;
      this.audio.jump();
    }
    const queued = this.input.consumeAttack();
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
        this.render.addShake(spec.shake);
        if (attacker.isPlayer) this.hits += 1;
        this.render.spawnSparks(
          target.x,
          ARENA.groundY + 1.75 + target.y,
          target.blocking ? "#70d6ff" : attacker.spec.tint,
        );
        this.audio.impact(target.blocking, raw);
        landed = true;
      }
      if (!landed) this.audio.miss();
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
      this.render.addShake(0.5);
      const fx = Math.max(ARENA_RULES.blast.left, Math.min(ARENA_RULES.blast.right, fighter.x));
      const fy = Math.max(-6, Math.min(8, fighter.y));
      this.render.spawnSparks(fx, ARENA.groundY + 2 + fy, fighter.spec.tint, 16);
      this.audio.ringOut();
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
        this.render.setFighterVisible(fighter, false);
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
    this.render.addShake(0.7);
    if (winner) {
      this.render.spawnSparks(
        Math.max(-6, Math.min(6, winner.x)),
        ARENA.groundY + 2.2 + Math.max(0, winner.y),
        outcome === "victory" ? "#ff7a1a" : "#9fe22e",
        22,
      );
    }
    this.audio.roundEnd(outcome);
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

  private createFighter(
    spec: FighterSpec,
    x: number,
    facing: 1 | -1,
    options: { slot?: number; isPlayer?: boolean; isBot?: boolean; stocks?: number } = {},
  ): RuntimeFighter {
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
      visual: this.render.createFighterVisual(spec),
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
    this.render.transformFighter(fighter);
    return fighter;
  }

  private clearFighters() {
    const all: (RuntimeFighter | null)[] = [this.player, this.opponent, ...this.arenaFighters];
    for (const fighter of all) {
      if (!fighter) continue;
      this.render.disposeFighterVisual(fighter);
    }
    this.player = null;
    this.opponent = null;
    this.arenaFighters = [];
    this.lastArenaStanding = null;
  }

  snapshot(): HudState {
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
    if (!this.disposed) this.listener(this.snapshot());
  }
}
