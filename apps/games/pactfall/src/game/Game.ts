import { createFixedLoop, type FixedLoop, recordWarResult } from "@deadrot/game-kit/core";
import { DamageNumbers, FlashOverlay, ParticleBursts, ScreenShake } from "@deadrot/game-kit/juice";
import { audio } from "../audio";
import { COLORS, CONSTANTS } from "./constants";
import { type AbilityKey, AbilitySystem } from "./systems/abilities";
import { EntitySystem } from "./systems/EntitySystem";
import { HudSystem } from "./systems/HudSystem";
import { InputSystem } from "./systems/InputSystem";
import { RenderSystem } from "./systems/RenderSystem";
import type { Phase } from "./types";

// One SFX cue per ability slot (presentation table, not a tunable).
const CAST_SFX: Record<AbilityKey, "laser" | "powerup" | "dash"> = {
  q: "laser",
  w: "powerup",
  e: "dash",
};

// Thin owner of shared state. It wires the systems together, runs the clamped
// rAF loop, exposes the run state the systems mutate, and — once per displayed
// frame — converts accumulated gameplay events into juice + audio.
export class Game {
  readonly render: RenderSystem;
  readonly input: InputSystem;
  readonly entities: EntitySystem;
  readonly abilities: AbilitySystem;
  readonly hud: HudSystem;

  // Shared run state
  phase: Phase = "title";
  buffTime = 0; // seconds of champion damage buff remaining
  elapsed = 0;

  // Pause is owned by the Game (Esc-toggled via the React shell). When set,
  // the loop keeps rendering but freezes the simulation so the player is
  // never stuck.
  paused = false;
  private readonly phaseListeners = new Set<(phase: Phase) => void>();
  private readonly pauseListeners = new Set<(paused: boolean) => void>();

  // Juice (presentation only): shake/bursts/numbers/flash consumed once per frame.
  private readonly shake = new ScreenShake();
  private readonly bursts: ParticleBursts;
  private readonly damageNumbers: DamageNumbers;
  private readonly flash: FlashOverlay;
  private hurtSfxIn = 0; // throttle for the hurt cue
  private heartbeatIn = 0; // low-health heartbeat cadence
  private lowHpActive = false;

  // Pactfall is a variable-step sim: run it in the render callback so the
  // shared loop only contributes the clamped rAF cadence, not fixed stepping.
  private readonly loop: FixedLoop = createFixedLoop({
    maxFrame: CONSTANTS.maxDelta,
    update: () => {},
    render: (_alpha, frameDt) => {
      this.update(Math.min(frameDt, CONSTANTS.maxDelta));
      this.render.draw();
    },
  });

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.render = new RenderSystem(canvas);
    this.input = new InputSystem(canvas, this.render);
    this.entities = new EntitySystem(this);
    this.abilities = new AbilitySystem(this);
    this.hud = new HudSystem(hudRoot);

    this.bursts = new ParticleBursts(this.render.scene);
    this.damageNumbers = new DamageNumbers(hudRoot, this.render.camera);
    this.flash = new FlashOverlay(hudRoot);

    // Click / R to redeploy once the match has resolved. Returns true when it
    // actually redeployed, so a redeploy click isn't also read as a move order.
    this.input.onRestart = () => {
      if (this.phase === "playing") return false;
      this.beginRun();
      return true;
    };

    this.entities.reset();
  }

  subscribePhaseChange(listener: (phase: Phase) => void): () => void {
    this.phaseListeners.add(listener);
    return () => {
      this.phaseListeners.delete(listener);
    };
  }

  subscribePauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);
    return () => {
      this.pauseListeners.delete(listener);
    };
  }

  beginRun(): void {
    this.buffTime = 0;
    this.elapsed = 0;
    this.setPaused(false);
    this.entities.reset();
    this.abilities.reset();
    // Q/W/E pressed on the title / victory / pause screens stay latched in the
    // input queue; drop them so a fresh run never opens with stale casts.
    this.input.clearAbilities();
    this.hurtSfxIn = 0;
    this.heartbeatIn = 0;
    this.lowHpActive = false;
    this.flash.setVignette(0);
    audio.unlock(); // beginRun always follows a user gesture (click / Enter / R)
    this.setPhase("playing");
  }

  pause(): void {
    if (this.phase === "playing") this.setPaused(true);
  }

  resume(): void {
    this.setPaused(false);
    // Presses buffered while the sim was frozen would all fire on the first
    // unpaused frame — discard them, same as beginRun().
    this.input.clearAbilities();
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const listener of this.pauseListeners) listener(paused);
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    for (const listener of this.phaseListeners) listener(phase);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  get buffed(): boolean {
    return this.buffTime > 0;
  }

  grantBuff(): void {
    this.buffTime = CONSTANTS.scourge.buffDuration;
  }

  win(): void {
    if (this.phase === "playing") {
      recordWarResult("pactfall", this.warResult("victory"), Date.now());
      this.setPaused(false);
      this.setPhase("won");
      audio.sfx("victory");
    }
  }

  lose(): void {
    if (this.phase === "playing") {
      recordWarResult("pactfall", this.warResult("defeat"), Date.now());
      this.setPaused(false);
      this.setPhase("lost");
      audio.sfx("defeat");
    }
  }

  private update(dt: number): void {
    // While paused, freeze the whole simulation (and camera drift) but keep the
    // HUD in sync; the React PauseMenu renders the overlay on top.
    if (this.paused) {
      this.hud.update(this);
      return;
    }

    this.render.update(dt);

    if (this.phase === "playing") {
      this.elapsed += dt;
      if (this.buffTime > 0) this.buffTime = Math.max(0, this.buffTime - dt);
      this.entities.update(dt);
      this.abilities.update(dt);
      this.render.followChampion(this.entities.champion.pos, dt);
    }

    this.consumeFeedback(dt);
    this.hud.update(this);
  }

  private warResult(outcome: "victory" | "defeat") {
    const enemyBaseDamage = CONSTANTS.base.maxHp - Math.max(0, this.entities.enemyBase.hp);
    const friendlyBaseHp = Math.max(0, this.entities.friendlyBase.hp);
    const score = Math.round(enemyBaseDamage + friendlyBaseHp * 0.25 + this.entities.champion.hp + this.elapsed * 2);
    return {
      outcome,
      score,
      timeMs: Math.round(this.elapsed * 1000),
      bossKill: this.buffed,
    };
  }

  // ---- per-frame juice + audio: turn sim events into feedback -----------------

  private consumeFeedback(dt: number): void {
    const ev = this.entities.events;
    const fb = CONSTANTS.feedback;

    // Hits: damage numbers for champion-dealt damage, small bursts for abilities.
    let hitCues = 0;
    for (const hit of ev.hits) {
      const point = { x: hit.x, y: hit.y, z: hit.z };
      if (hit.dealerIsPlayer) {
        this.damageNumbers.spawn(point, Math.round(hit.amount), hit.ability ? "head" : "normal");
        if (hitCues < fb.maxHitSfxPerFrame) {
          audio.sfx("hit", { pitch: 0.92 + Math.random() * 0.2 });
          hitCues++;
        }
      } else if (hit.targetIsPlayer) {
        this.damageNumbers.spawn(point, Math.round(hit.amount), "crit");
      }
      if (hit.ability) {
        this.bursts.spawn({
          position: point,
          color: hit.dealerTeam === "pyre" ? COLORS.hellfire : COLORS.blood,
          count: 10,
          speed: 5,
          life: 0.35,
          size: 0.16,
        });
      }
    }

    // Kills: faction-colored pops; champion takedowns hit harder.
    let killCues = 0;
    for (const kill of ev.kills) {
      const champ = kill.kind === "champion";
      const color =
        kill.kind === "scourge" ? COLORS.toxic : kill.dealerTeam === "pyre" ? COLORS.hellfire : COLORS.blood;
      this.bursts.spawn({
        position: { x: kill.x, y: Math.max(0.9, kill.y), z: kill.z },
        color,
        count: champ || kill.kind === "scourge" ? 36 : 14,
        speed: champ ? 7 : 4.5,
        life: champ ? 0.7 : 0.45,
        gravity: 6,
        upwardBias: 0.5,
        size: champ ? 0.26 : 0.16,
      });
      if (champ) {
        this.shake.kick(fb.shake.championKill);
        audio.sfx("kill", { pitch: 0.72 });
      } else if (kill.dealerIsPlayer && killCues < fb.maxKillSfxPerFrame) {
        audio.sfx("kill", { pitch: 0.95 + Math.random() * 0.2 });
        killCues++;
      }
    }

    // Taking damage: kick the camera, cue hurt (throttled so chip isn't a siren).
    this.hurtSfxIn = Math.max(0, this.hurtSfxIn - dt);
    if (ev.playerDamage > 0) {
      this.shake.kick(Math.min(0.4, fb.shake.playerHit + ev.playerDamage * 0.004));
      if (this.hurtSfxIn <= 0) {
        audio.sfx("hurt");
        this.hurtSfxIn = fb.hurtSfxCooldown;
      }
    }

    if (ev.playerDied) {
      this.flash.flash("#c1121f", { alpha: 0.5, duration: 0.5 });
      this.shake.kick(fb.shake.playerDeath);
    }
    if (ev.buffGained) audio.sfx("levelup");

    // Ability cast cues — the Warden's telegraphed lance gets a low-pitch cue
    // so the dodge window is audible, not just visible.
    const ab = this.abilities.events;
    for (const key of ab.playerCasts) {
      audio.sfx(CAST_SFX[key]);
      if (key === "e") {
        const c = this.entities.champion;
        this.bursts.spawn({
          position: { x: c.pos.x, y: 0.4, z: c.pos.z },
          color: COLORS.ash,
          count: 12,
          speed: 3.5,
          life: 0.4,
          gravity: 7,
          upwardBias: 0.7,
          size: 0.14,
        });
      }
    }
    for (const key of ab.enemyCasts) {
      if (key === "q") audio.sfx("laser", { pitch: 0.7 });
    }
    if (ab.dryfire) audio.sfx("dryfire");

    // Low-health heartbeat + vignette (throttled, state-edge driven). Gated on
    // !paused too so the heartbeat can never thump over the pause menu.
    const c = this.entities.champion;
    const low =
      this.phase === "playing" && !this.paused && c.alive && c.hp <= c.maxHp * CONSTANTS.champion.lowHpFraction;
    if (low !== this.lowHpActive) {
      this.lowHpActive = low;
      this.flash.setVignette(low ? 0.5 : 0);
    }
    if (low) {
      this.heartbeatIn -= dt;
      if (this.heartbeatIn <= 0) {
        audio.sfx("lowhealth");
        this.heartbeatIn = fb.heartbeatInterval;
      }
    } else {
      this.heartbeatIn = 0;
    }

    this.entities.clearEvents();
    this.abilities.clearEvents();

    // Advance the juice once per displayed frame; shake offsets ride on the
    // follow-cam pose computed just above.
    this.shake.update(dt);
    if (this.phase === "playing" && !this.paused) {
      this.render.camera.position.x += this.shake.offsetX;
      this.render.camera.position.y += this.shake.offsetY;
    }
    this.bursts.update(dt);
    this.damageNumbers.update(dt);
    this.flash.update(dt);
  }
}
