import { CONSTANTS } from "./constants";
import type { GameState } from "./types";
import { RenderSystem } from "./systems/render";
import { EntitySystem } from "./systems/entities";
import { InputSystem } from "./systems/input";
import { HudSystem } from "./systems/hud";

/**
 * Game — the thin owner of shared state + the systems, per studio convention.
 * It runs a single requestAnimationFrame loop with a clamped delta and drives
 * the wave director (the only "AI" in the build).
 */
export class Game {
  private readonly state: GameState = freshState();

  private readonly render: RenderSystem;
  private readonly entities: EntitySystem;
  private readonly input: InputSystem;
  private readonly hud: HudSystem;

  private last = 0;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas);
    this.entities = new EntitySystem(this.render.scene);
    this.input = new InputSystem(
      canvas,
      this.render.camera,
      this.render.groundPlane,
    );
    this.hud = new HudSystem();

    this.hud.bannerBtn.addEventListener("click", () => this.onBannerClick());

    this.hud.showBanner(
      "DEADLANE",
      "WARDENS — HOLD THE LANE. BUILD TOWERS. STOP THE SCOURGE.",
      "DEPLOY",
    );
    this.hud.update(this.state);

    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- state transitions ----------------------------------------------------

  private onBannerClick(): void {
    if (this.state.phase === "menu") {
      this.startRun();
    } else if (this.state.phase === "won" || this.state.phase === "lost") {
      this.resetRun();
    }
  }

  private startRun(): void {
    this.hud.hideBanner();
    this.state.phase = "building";
    this.beginInterWave(CONSTANTS.waves.interWaveDelay);
  }

  private resetRun(): void {
    this.entities.clear(this.state);
    Object.assign(this.state, freshState());
    this.hud.update(this.state);
    this.startRun();
  }

  private beginInterWave(delay: number): void {
    this.state.phase = "building";
    this.state.interWaveTimer = delay;
  }

  private beginWave(): void {
    this.state.wave += 1;
    this.state.phase = "wave";
    this.state.spawnQueue =
      CONSTANTS.waves.baseCount +
      (this.state.wave - 1) * CONSTANTS.waves.countGrowth;
    this.state.spawnTimer = 0;
  }

  // ---- main loop ------------------------------------------------------------

  private frame(now: number): void {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, CONSTANTS.loop.maxDelta);
    this.elapsed += dt;

    this.step(dt);

    this.render.update(dt, this.elapsed, this.entities.baseHitThisFrame);
    this.render.render();

    requestAnimationFrame((t) => this.frame(t));
  }

  private step(dt: number): void {
    const s = this.state;

    if (s.phase === "building" || s.phase === "wave") {
      this.handleBuild();
      this.entities.update(s, dt, this.elapsed);
      this.director(dt);
      this.checkEndConditions();
    } else {
      // menu / won / lost: keep entities frozen but still let hover idle off
      this.render.setHover(null, null, false);
    }

    this.hud.update(s);
  }

  /** Wave director: spawns creeps, paces waves, declares victory. */
  private director(dt: number): void {
    const s = this.state;

    if (s.phase === "building") {
      s.interWaveTimer -= dt;
      if (s.interWaveTimer <= 0) {
        if (s.wave >= CONSTANTS.waves.total) {
          // all waves already cleared
          this.win();
        } else {
          this.beginWave();
        }
      }
      return;
    }

    if (s.phase === "wave") {
      // spawn the queue
      if (s.spawnQueue > 0) {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          this.entities.spawnCreep(s);
          s.spawnQueue -= 1;
          s.spawnTimer = CONSTANTS.waves.spawnInterval;
        }
      } else if (s.creeps.length === 0) {
        // wave cleared
        s.gold += CONSTANTS.economy.waveClearBonus;
        if (s.wave >= CONSTANTS.waves.total) {
          this.win();
        } else {
          this.beginInterWave(CONSTANTS.waves.interWaveDelay);
        }
      }
    }
  }

  private handleBuild(): void {
    const s = this.state;
    const occupied = this.occupiedSet();
    const hover = this.input.hover;
    const valid = InputSystem.isBuildable(hover, occupied);

    this.render.setHover(
      hover?.col ?? null,
      hover?.row ?? null,
      valid && s.gold >= CONSTANTS.economy.towerCost,
    );

    const click = this.input.takeClick();
    if (click && InputSystem.isBuildable(click, occupied)) {
      this.entities.buildTower(s, click.col, click.row);
    }
  }

  private occupiedSet(): Set<string> {
    const set = new Set<string>();
    for (const t of this.state.towers) set.add(`${t.col},${t.row}`);
    return set;
  }

  private checkEndConditions(): void {
    if (this.state.baseHp <= 0) this.lose();
  }

  private win(): void {
    if (this.state.phase === "won") return;
    this.state.phase = "won";
    this.hud.showBanner(
      "LINE HELD",
      "THE SCOURGE IS SPENT. THE WARDENS STAND. WELL FOUGHT.",
      "RUN IT BACK",
    );
  }

  private lose(): void {
    if (this.state.phase === "lost") return;
    this.state.phase = "lost";
    this.entities.clear(this.state);
    this.hud.showBanner(
      "BREACH",
      "THE BASE IS OVERRUN. THE LANE IS LOST.",
      "TRY AGAIN",
    );
  }
}

function freshState(): GameState {
  return {
    phase: "menu",
    gold: CONSTANTS.economy.startGold,
    wave: 0,
    baseHp: CONSTANTS.base.startHp,
    towers: [],
    creeps: [],
    projectiles: [],
    spawnQueue: 0,
    spawnTimer: 0,
    interWaveTimer: 0,
  };
}
