import { recordWarResult } from "@deadrot/game-kit/core";
import * as THREE from "three";
import { ARENA } from "./constants";
import { ATTACKS, attackDamage, guardedDamage } from "./combat";
import { DEFAULT_PLAYER_ID, fighterById, pickOpponent, type FighterId, type FighterSpec } from "./roster";
import type { AttackKind, FighterHud, HudState, InputAction, RoundResult, StateListener } from "./types";

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
}

interface Spark {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
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
  private selectedId: FighterId = DEFAULT_PLAYER_ID;
  private opponentId: FighterId | null = null;
  private player: RuntimeFighter | null = null;
  private opponent: RuntimeFighter | null = null;
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
    this.selectedId = id;
    this.opponentId = pickOpponent(id);
    this.clearFighters();
    this.player = this.createFighter(fighterById(id), -4.9, 1);
    this.opponent = this.createFighter(fighterById(this.opponentId), 4.9, -1);
    this.status = "playing";
    this.result = null;
    this.timer = ARENA.roundSeconds;
    this.hits = 0;
    this.resultRecorded = false;
    this.roundStartedAt = performance.now();
    this.tone(180, 0.08, "sawtooth");
    this.emit();
  }

  rematch() {
    this.startFight(this.selectedId);
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

  debugSnapshot(): HudState & { playerX: number | null; opponentX: number | null } {
    return {
      ...this.hudState(),
      playerX: this.player?.x ?? null,
      opponentX: this.opponent?.x ?? null,
    };
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
    if (this.status === "playing") this.updateRound(delta);
    this.updateSparks(delta);
    this.render();
    this.emitAccumulator += delta;
    if (this.emitAccumulator >= 0.06) {
      this.emitAccumulator = 0;
      this.emit();
    }
  };

  private updateRound(delta: number) {
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

  private startAttack(fighter: RuntimeFighter, kind: AttackKind) {
    if (this.status !== "playing" || fighter.cooldown > 0 || fighter.attack || fighter.blocking || fighter.hurt > 0) {
      return;
    }
    const spec = ATTACKS[kind];
    fighter.attack = { kind, elapsed: 0, didHit: false };
    fighter.cooldown = spec.cooldown;
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
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      const duration = Math.max(1, performance.now() - this.roundStartedAt);
      const score = Math.round((winner.health / winner.spec.maxHealth) * 500 + this.timer * 10 + this.hits * 25);
      recordWarResult(
        "brawl",
        {
          outcome,
          score,
          timeMs: duration,
          bossKill: outcome === "victory" && loser.spec.faction === "Scourge",
        },
        Date.now(),
      );
    }
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
    material.opacity = fighter.hurt > 0 && Math.floor(fighter.hurt * 40) % 2 === 0 ? 0.55 : 1;
    material.color.set(fighter.blocking ? "#b7ecff" : "#ffffff");
  }

  private render() {
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.45 : 0;
    this.camera.position.x = shakeX;
    this.camera.position.y = shakeY;
    this.shake = Math.max(0, this.shake - 0.035);
    this.renderer.render(this.scene, this.camera);
  }

  private createFighter(spec: FighterSpec, x: number, facing: 1 | -1): RuntimeFighter {
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
    };
    this.transformFighter(fighter);
    return fighter;
  }

  private clearFighters() {
    for (const fighter of [this.player, this.opponent]) {
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
      selectedId: this.selectedId,
      opponentId: this.opponentId,
      timer: Math.ceil(this.timer),
      player: this.player ? this.fighterHud(this.player) : null,
      opponent: this.opponent ? this.fighterHud(this.opponent) : null,
      result: this.result,
      hits: this.hits,
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
    this.camera.left = -visibleWidth / 2;
    this.camera.right = visibleWidth / 2;
    this.camera.top = visibleHeight / 2;
    this.camera.bottom = -visibleHeight / 2;
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
