import { type CameraRig, makeMoveIntent, RectBounds, type WorldBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import {
  ARENA_HALF,
  PLAYER_HEIGHT,
  PLAYER_MAX_HEALTH,
  STARTING_WEAPON,
  WEAPON_ORDER,
  WEAPONS,
  type WeaponId,
} from "./constants";
import { type ArenaMap, DEFAULT_MAP_ID, getMap } from "./data/maps";
import { createIdleMissionState, type MissionRunState } from "./data/missions";
import { SURV_BASE_MAGNET, type SurvivorClassId } from "./data/survivors";
import type { Enemy } from "./entities/Enemy";
import type { GameStatus, StateListener } from "./types";

/**
 * The shared mutable world. Systems are behaviour modules that operate on this
 * context; any state touched by more than one system lives here. Each system
 * also receives a GameSystems registry (see ./systems) to call its siblings.
 *
 * State that belongs to a single system (wave/boss counters, survivor run state,
 * net session, HUD sequence counters, weapon view-model, transient FX pools…)
 * stays private on that system, reached cross-system via `this.sys.<name>`.
 */
export class GameContext {
  constructor(
    public readonly container: HTMLElement,
    public readonly listener: StateListener,
  ) {}

  // --- core three.js objects (created by RenderSystem during start) ---
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  // The camera seam (created by RenderSystem during start). The FPS preset welds
  // body===attach===camera, so `camera` below is also the player body — but player
  // logic should read `body`/`rig.facing`, and treat `camera` as render-only.
  rig!: CameraRig;
  /** Render/projection camera, owned by the rig. */
  get camera(): THREE.PerspectiveCamera {
    return this.rig.camera;
  }
  /** Canonical player world-transform (FPS preset: ===camera). */
  get body(): THREE.Object3D {
    return this.rig.body;
  }
  accentA!: THREE.PointLight; // two rim lights; created by RenderSystem, recoloured per-map by ArenaSystem
  accentB!: THREE.PointLight;
  readonly clock = new THREE.Clock();
  readonly raycaster = new THREE.Raycaster();
  readonly screenCenter = new THREE.Vector2(0, 0);
  raf = 0;
  disposed = false;

  // --- world collision / hit-test targets ---
  solidMeshes: THREE.Mesh[] = []; // arena solids only (used to prune raycastTargets on rebuild)
  obstacleBoxes: THREE.Box3[] = []; // collider AABBs (non-elevated obstacles)
  raycastTargets: THREE.Object3D[] = []; // arena solids + enemy + remote-avatar hit meshes
  enemies: Enemy[] = []; // shared pooled enemy array (contains dead entries)

  // --- arena / campaign map ---
  currentMap: ArenaMap = getMap(DEFAULT_MAP_ID);
  /** Horizontal play-area bounds (XZ). Published by ArenaSystem; default = the square arena. */
  bounds: WorldBounds = RectBounds.square(ARENA_HALF);
  campaignMaps: ArenaMap[] = [];
  campaignStage = 0; // 0-based index into campaignMaps
  mission: MissionRunState = createIdleMissionState();

  // --- muzzle flash (armed by WeaponSystem.shoot, decayed by FxSystem.updateEffects) ---
  muzzleFlash!: THREE.Sprite;
  muzzleLight!: THREE.PointLight;
  muzzleTimer = 0;

  // --- camera juice: screenshake trauma (0..1) + transient recoil pitch kick +
  // a tiny world-freeze (hitstop). Set via FxSystem helpers, applied in
  // RenderSystem.render, decayed in FxSystem.updateEffects, frozen in Game.loop. ---
  shakeTrauma = 0;
  camRecoil = 0;
  hitstopTimer = 0;

  // --- kill-streak combo: the horde dopamine engine. Bumped on every kill,
  // decays after comboTimer runs out (FxSystem.updateEffects). ---
  combo = 0;
  comboBest = 0;
  comboTimer = 0;

  // --- mode / phase ---
  status: GameStatus = "pointerlock-needed";
  outcome: "win" | "dead" | null = null;
  campaign = false;
  multiplayer = false;
  survivors = false;
  /** Dev-only labs/sandbox mode: real sim, no wave director progression. */
  sandbox = false;

  // --- player ---
  health = PLAYER_MAX_HEALTH;
  score = 0;
  kills = 0;
  headshots = 0;
  time = 0;
  damageBoostTimer = 0;
  velocity = new THREE.Vector3();
  canJump = false;
  groundY = 0;
  stanceHeight = PLAYER_HEIGHT;
  wantsSprint = false;
  wantsCrouch = false;
  move = makeMoveIntent();
  firing = false;
  triggerQueued = false;
  aimingDownSights = false;
  adsT = 0;
  adsZoomIndex = 0;

  // --- weapons / ammo (live values of the active weapon + per-weapon stash) ---
  activeWeapon: WeaponId = STARTING_WEAPON;
  unlocked = new Set<WeaponId>([STARTING_WEAPON]);
  weaponMag: Record<WeaponId, number> = Object.fromEntries(WEAPON_ORDER.map((id) => [id, 0])) as Record<
    WeaponId,
    number
  >;
  weaponReserve: Record<WeaponId, number> = Object.fromEntries(WEAPON_ORDER.map((id) => [id, 0])) as Record<
    WeaponId,
    number
  >;
  ammo = WEAPONS[STARTING_WEAPON].magazineSize;
  reserve = WEAPONS[STARTING_WEAPON].reserve;
  reloading = false;
  reloadTimer = 0;
  fireCooldown = 0;
  dualWeaponTimer = 0;

  // --- survivor-derived stat multipliers (1 / 0 / SURV_BASE_MAGNET = no effect,
  // so campaign + multiplayer stay unaffected). Written by SurvivorsSystem.recomputeStats. ---
  statDamageMul = 1;
  statFireRateMul = 1;
  statMoveMul = 1;
  statMaxHpBonus = 0;
  statRegen = 0;
  statMagnet = SURV_BASE_MAGNET;
  statXpMul = 1;
  statCrit = 0;
  statMultishot = 0;
  statArmor = 0;
  statShieldMax = 0;
  statShield = 0;
  statShieldRegen = 0;
  statRetaliate = 0;
  statKillHeal = 0;
  statBastion = 0;
  statDodge = 0;
  statGrace = 0;
  damageGraceTimer = 0;

  // --- Survivors run identity / structured breach journey ---
  survivorClassId: SurvivorClassId = "ranger";
  survivorChapter = 0;
  survivorTotalChapters = 0;
  survivorGoalTime = 0;

  // --- shared scratch (single reused instances) ---
  readonly _dir = new THREE.Vector3();
  readonly _origin = new THREE.Vector3();
  readonly _fwd = new THREE.Vector3();
  readonly _right = new THREE.Vector3();
  readonly _up = new THREE.Vector3();
  readonly _worldUp = new THREE.Vector3(0, 1, 0);

  /** Max player HP including the survivor Vigor bonus (statMaxHpBonus is 0 outside Survivors). */
  get maxHealthValue(): number {
    return PLAYER_MAX_HEALTH + this.statMaxHpBonus;
  }

  /** Live enemy count (the pooled array also holds dead entries). */
  get aliveCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }
}
