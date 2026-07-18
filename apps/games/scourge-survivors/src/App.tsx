import { completeRun, createRunNonce } from "@deadrot/game-kit/warline";
import { GlobalMusicToggle, subscribeGlobalGameSettings } from "@shipshitgames/ui";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "./audio/AudioEngine";
import { HUD } from "./components/HUD";
import { CinematicOverlay } from "./components/hud/CinematicOverlay";
import {
  MAGAZINE_SIZE,
  type PickupKind,
  PLAYER_MAX_HEALTH,
  START_RESERVE,
  STARTING_WEAPON,
  TOTAL_WAVES,
  WEAPONS,
  type WeaponId,
} from "./game/constants";
import {
  type CinematicBeat,
  cinematicAssignmentFor,
  cinematicForRunOutcome,
  cinematicForRunProgress,
  cinematicForRunStart,
} from "./game/data/cinematics";
import { DEFAULT_MAP_ID, normalizeMapId } from "./game/data/maps";
import {
  type MainWeaponVisualTier,
  runBiomass,
  runGold,
  SHOP_BY_ID,
  type ShopId,
  SURVIVOR_RUN_GOAL_TIME,
  type SurvivorClassId,
  shopCost,
  xpForLevel,
} from "./game/data/survivors";
import { weaponIdentityFor } from "./game/data/weaponIdentity";
import type { SandboxEnemyKind } from "./game/Game";
import { Game } from "./game/Game";
import {
  clearScores,
  loadScores,
  loadShop,
  type ScoreEntry,
  type ShopState,
  saveScore,
  saveShop,
} from "./game/storage";
import type { HudState } from "./game/types";
import type { PlayerAvatarId } from "./net/playerAvatars";
import { WarEffortBadge } from "./WarEffortBadge";

const SandboxPanel = import.meta.env.DEV
  ? lazy(() => import("./components/SandboxPanel").then((mod) => ({ default: mod.SandboxPanel })))
  : null;

// Build-time constant (Vite statically replaces `import.meta.env.DEV`). Kept at
// module scope so it is never treated as a hook dependency.
const sandboxAvailable = import.meta.env.DEV;

const INITIAL_WEAPON_IDENTITY = weaponIdentityFor(STARTING_WEAPON);

interface CombatLaunchRequest {
  start: (game: Game) => Promise<void>;
  onSuccess?: () => void;
}

const INITIAL_STATE: HudState = {
  status: "pointerlock-needed",
  playerHealth: PLAYER_MAX_HEALTH,
  maxPlayerHealth: PLAYER_MAX_HEALTH,
  ammo: MAGAZINE_SIZE,
  magazineSize: MAGAZINE_SIZE,
  reserve: START_RESERVE,
  reloading: false,
  reloadProgress: 0,
  score: 0,
  kills: 0,
  headshots: 0,
  bossKills: 0,
  enemiesAlive: 0,
  combo: 0,
  time: 0,
  runMode: "campaign",
  runDepth: 1,
  runDepthTotal: TOTAL_WAVES,
  runDepthName: "Ashgate",
  wave: 1,
  totalWaves: TOTAL_WAVES,
  campaignStage: 1,
  campaignTotalStages: 0,
  mapName: "Ashgate",
  bossActive: false,
  bossHealthFrac: 0,
  bossName: null,
  outcome: null,
  weapon: WEAPONS[STARTING_WEAPON].name,
  weapons: [{ id: STARTING_WEAPON, name: WEAPONS[STARTING_WEAPON].name, key: 1, active: true }],
  weaponIdentity: {
    callsign: INITIAL_WEAPON_IDENTITY.callsign,
    role: INITIAL_WEAPON_IDENTITY.role,
    fantasy: INITIAL_WEAPON_IDENTITY.fantasy,
    ads: INITIAL_WEAPON_IDENTITY.ads.label,
    dualCompatible: INITIAL_WEAPON_IDENTITY.dualCompatible,
  },
  damageBoost: 0,
  berserk: 0,
  berserkFrac: 0,
  dualWeapon: 0,
  ads: false,
  adsZoom: 1,
  adsZoomLevels: 1,
  bossShielded: false,
  bossEnraged: false,
  hitSeq: 0,
  emphasisSeq: 0,
  killSeq: 0,
  damageSeq: 0,
  banner: "",
  bannerSeq: 0,
  toast: "",
  toastSeq: 0,
  damageNumbers: [],
  multiplayer: false,
  connected: false,
  room: "",
  scoreboard: [],
  campaign: false,
  missionId: "",
  missionTitle: "",
  missionPhase: "idle",
  missionObjective: "",
  missionCheckpoint: "",
  missionEncounter: "",
  missionExtractionReady: false,
  missionComplete: false,
  sandbox: false,
  survivors: false,
  survivorClassId: "ranger",
  survivorClassName: "Ranger",
  survivorClassRole: "Balanced Pyre-operator",
  survivorClassIcon: "target",
  survivorChapter: 1,
  survivorTotalChapters: 4,
  survivorChapterName: "Ashgate Drop",
  survivorChapterSubtitle: "Hold the foundry wall while the breach wakes.",
  survivorChapterProgress: 0,
  survivorGoalTime: SURVIVOR_RUN_GOAL_TIME,
  survivorShield: 0,
  survivorMaxShield: 0,
  survivorArmor: 0,
  survivorDodge: 0,
  survivorGrace: 0,
  survivorEvolved: [],
  survivorWeaponTier: "base",
  survivorWeaponTierLabel: "TIER I",
  survivorWeaponTierIndex: 0,
  survivorWeaponTierDamageMul: 1,
  level: 1,
  xp: 0,
  xpToNext: xpForLevel(1),
  build: [],
  choices: [],
  rerolls: 0,
  banishes: 0,
};

// react-doctor-disable-next-line react-doctor/no-giant-component -- Scourge Survivors keeps the imperative Three.js game shell in one boundary; splitting it belongs in a dedicated engine/UI refactor.
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const hudRef = useRef<HudState>(INITIAL_STATE);
  const combatLaunchGenerationRef = useRef(0);
  const combatRetryRef = useRef<CombatLaunchRequest | undefined>(undefined);
  const [hud, setHudState] = useState<HudState>(INITIAL_STATE);
  const [combatAssetLoading, setCombatAssetLoading] = useState(false);
  const [combatAssetError, setCombatAssetError] = useState<string>();
  const [activeCinematic, setActiveCinematic] = useState<CinematicBeat | null>(null);
  const activeArenaIdRef = useRef(DEFAULT_MAP_ID);
  const cinematicChapterRef = useRef(INITIAL_STATE.survivorChapter);
  const cinematicCompletionRef = useRef<() => void>(() => {});
  const showCinematic = useCallback((beat: CinematicBeat | null, onComplete: () => void) => {
    if (!beat) {
      onComplete();
      return;
    }
    cinematicCompletionRef.current = onComplete;
    setActiveCinematic(beat);
  }, []);
  const completeCinematic = useCallback(() => {
    const onComplete = cinematicCompletionRef.current;
    cinematicCompletionRef.current = () => {};
    setActiveCinematic(null);
    onComplete();
  }, []);
  const clearCinematic = useCallback(() => {
    cinematicCompletionRef.current = () => {};
    setActiveCinematic(null);
  }, []);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [shop, setShop] = useState<ShopState>(() => loadShop());
  const lastRunGoldRef = useRef(0);
  const savedRef = useRef(false);
  // Generated once for the active run and replaced only after it leaves the
  // game-over state, so repeated HUD snapshots cannot bank the run twice.
  const runNonceRef = useRef<string | null>(null);
  if (runNonceRef.current === null) runNonceRef.current = createRunNonce("scourge-survivors");
  const currentRunNonce = useCallback(() => {
    if (runNonceRef.current === null) runNonceRef.current = createRunNonce("scourge-survivors");
    return runNonceRef.current;
  }, []);
  // A shared link like `?room=ARENA-AB12` lands the player on the PvP preview screen.
  const initialRoom = useMemo(
    () => (new URLSearchParams(window.location.search).get("room") || "").toUpperCase().slice(0, 24),
    [],
  );
  const initialSandbox = useMemo(
    () => sandboxAvailable && new URLSearchParams(window.location.search).get("sandbox") === "1",
    // `sandboxAvailable` is `import.meta.env.DEV`, a build-time constant — never a reactive dep.
    [],
  );
  const [sandboxActive, setSandboxActive] = useState(false);
  const setRoomInUrl = useCallback((room: string) => {
    const url = room ? `${window.location.pathname}?room=${encodeURIComponent(room)}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);
  const setSandboxInUrl = useCallback((active: boolean) => {
    const url = active ? `${window.location.pathname}?sandbox=1` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);
  // Latest shop tiers for the engine-facing callbacks below — the Game holds
  // one stable setHud reference for its whole life, so it can't close over
  // `shop` directly without going stale.
  const shopTiersRef = useRef(shop.tiers);
  useEffect(() => {
    shopTiersRef.current = shop.tiers;
  }, [shop.tiers]);

  // Record a run on the leaderboard (and award Survivors gold) once per
  // game-over, right where the engine pushes the HUD snapshot — the game-over
  // "event" originates here, not in a React render.
  const setHud = useCallback(
    (next: HudState) => {
      const previous = hudRef.current;
      hudRef.current = next;
      if (next.status === "gameover" && next.outcome && !next.sandbox && !savedRef.current) {
        savedRef.current = true;
        if (next.outcome === "win") audio.setMusicMode("victory");
        const earnedGold = next.survivors
          ? runGold(next.kills, next.level, next.time, shopTiersRef.current.greed ?? 0)
          : 0;
        lastRunGoldRef.current = earnedGold;
        setScores(
          saveScore({
            score: next.score,
            kills: next.kills,
            headshots: next.headshots,
            time: next.time,
            outcome: next.outcome,
            mode: next.runMode,
            level: next.level,
            depthReached: next.runDepth,
            depthTotal: next.runDepthTotal,
            depthName: next.runDepthName,
            goldEarned: earnedGold,
            date: Date.now(),
          }),
        );
        // Survivors chapter runs progress by depth, not the clamped arena wave.
        // `contributed` is biomass banked into the shared effort regardless of outcome.
        completeRun("scourge-survivors", {
          outcome: next.outcome === "win" ? "victory" : "defeat",
          score: next.score,
          wave: next.survivors ? Math.max(next.runDepth, next.wave) : next.wave,
          bossKill: next.bossKills,
          contributed: runBiomass(next.kills, next.level, next.time),
          nonce: currentRunNonce(),
        });
        if (next.survivors) {
          setShop((prev) => {
            const nextShop = { ...prev, gold: prev.gold + earnedGold };
            saveShop(nextShop);
            return nextShop;
          });
        } else {
          lastRunGoldRef.current = 0;
        }
        showCinematic(cinematicForRunOutcome(activeArenaIdRef.current, next.outcome), () => {});
      } else if (next.status !== "gameover") {
        if (previous.status === "gameover") runNonceRef.current = createRunNonce("scourge-survivors");
        savedRef.current = false;
        lastRunGoldRef.current = 0;
      }
      setHudState(next);
    },
    [currentRunNonce, showCinematic],
  );

  const runCombatLaunch = useCallback(async (request: CombatLaunchRequest): Promise<void> => {
    const game = gameRef.current;
    if (!game) return;
    const generation = ++combatLaunchGenerationRef.current;
    combatRetryRef.current = request;
    setCombatAssetError(undefined);
    setCombatAssetLoading(true);
    try {
      await request.start(game);
    } catch (error: unknown) {
      if (generation !== combatLaunchGenerationRef.current || gameRef.current !== game) return;
      audio.setMusicMode("menu");
      setCombatAssetLoading(false);
      setCombatAssetError(error instanceof Error ? error.message : String(error));
      return;
    }
    if (generation !== combatLaunchGenerationRef.current || gameRef.current !== game) return;
    combatRetryRef.current = undefined;
    setCombatAssetLoading(false);
    request.onSuccess?.();
  }, []);

  // Mirror the global music/SFX sliders + mute (the shared GlobalGameSettingsPanel)
  // into the AudioEngine bus gains. subscribe fires once immediately with the
  // stored settings, so this also seeds the initial levels on mount.
  useEffect(() => {
    return subscribeGlobalGameSettings((s) => {
      audio.setMusicLevel(s.effectLevels.music);
      audio.setSfxLevel(s.effectLevels.sound);
      audio.setMusicMuted(s.musicMuted);
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const game = new Game(container, setHud);
    gameRef.current = game;
    game.setShopUpgrades(shopTiersRef.current);
    game.start();
    if (initialSandbox) {
      void runCombatLaunch({
        start: (current) => current.startSandbox(),
        onSuccess: () => {
          setSandboxActive(true);
          setSandboxInUrl(true);
        },
      });
    }
    if (import.meta.env.DEV) {
      (window as unknown as { __fpsGame?: Game; __fpsAudio?: typeof audio; __hudSnapshot?: () => HudState }).__fpsGame =
        game;
      (window as unknown as { __fpsAudio?: typeof audio; __hudSnapshot?: () => HudState }).__fpsAudio = audio;
      (window as unknown as { __hudSnapshot?: () => HudState }).__hudSnapshot = () => hudRef.current;
    }
    return () => {
      combatLaunchGenerationRef.current++;
      game.dispose();
      gameRef.current = null;
    };
  }, [initialSandbox, runCombatLaunch, setHud, setSandboxInUrl]);

  useEffect(() => {
    if (!hud.survivors || hud.status === "gameover") {
      cinematicChapterRef.current = hud.survivorChapter;
      return;
    }
    if (hud.survivorChapter <= cinematicChapterRef.current) {
      cinematicChapterRef.current = hud.survivorChapter;
      return;
    }

    const progressIndex = hud.survivorChapter - 2;
    cinematicChapterRef.current = hud.survivorChapter;
    const stinger = cinematicForRunProgress(activeArenaIdRef.current, progressIndex);
    if (!stinger || activeCinematic) return;

    gameRef.current?.suspendForCinematic();
    showCinematic(stinger, () => gameRef.current?.resumeFromCinematic());
  }, [activeCinematic, hud.status, hud.survivorChapter, hud.survivors, showCinematic]);

  const handleLock = useCallback(() => {
    audio.unlock();
    gameRef.current?.requestLock();
  }, []);
  const handleEscapeResume = useCallback(() => {
    gameRef.current?.resumeFromPauseWithoutCapture();
  }, []);
  const handleRestart = useCallback(() => {
    audio.unlock();
    const current = hudRef.current;
    const restart = () => {
      audio.setMusicMode(current.multiplayer ? "multiplayer" : current.survivors ? "survivors" : "campaign");
      gameRef.current?.restart();
    };
    if (current.multiplayer || current.sandbox) {
      restart();
      return;
    }
    showCinematic(cinematicForRunStart(activeArenaIdRef.current), restart);
  }, [showCinematic]);
  const handleClearScores = useCallback(() => setScores(clearScores()), []);
  const handleStartMultiplayer = useCallback(
    async (name: string, room: string, avatar: PlayerAvatarId) => {
      audio.unlock();
      await runCombatLaunch({
        start: (game) => game.startMultiplayer(room, name, avatar),
        onSuccess: () => {
          audio.setMusicMode("multiplayer");
          setSandboxActive(false);
          setSandboxInUrl(false);
          setRoomInUrl(room);
        },
      });
    },
    [runCombatLaunch, setRoomInUrl, setSandboxInUrl],
  );
  const handleLeaveRoom = useCallback(() => {
    setRoomInUrl("");
    audio.setMusicMode("menu");
    gameRef.current?.leaveMultiplayer(true);
  }, [setRoomInUrl]);
  const handleStartSurvivors = useCallback(
    async (classId?: SurvivorClassId, mapId?: string) => {
      audio.unlock();
      activeArenaIdRef.current = normalizeMapId(mapId);
      await runCombatLaunch({
        start: (game) => game.startSurvivors(classId, mapId),
        onSuccess: () => {
          audio.setMusicMode("survivors");
          setSandboxActive(false);
          setSandboxInUrl(false);
          showCinematic(cinematicForRunStart(activeArenaIdRef.current), () => gameRef.current?.requestLock());
        },
      });
    },
    [runCombatLaunch, setSandboxInUrl, showCinematic],
  );
  const handleStartSandbox = useCallback(
    async (mapId?: string) => {
      if (!sandboxAvailable) return;
      audio.unlock();
      await runCombatLaunch({
        start: (game) => game.startSandbox(mapId),
        onSuccess: () => {
          setRoomInUrl("");
          setSandboxActive(true);
          setSandboxInUrl(true);
        },
      });
    },
    [runCombatLaunch, setRoomInUrl, setSandboxInUrl],
  );
  const handleExitSandbox = useCallback(() => {
    setSandboxActive(false);
    setSandboxInUrl(false);
    gameRef.current?.returnToMenu();
  }, [setSandboxInUrl]);
  const handleSandboxWeapon = useCallback((id: WeaponId) => {
    audio.unlock();
    gameRef.current?.setSandboxWeapon(id);
  }, []);
  const handleSandboxWeaponTier = useCallback((tier: MainWeaponVisualTier) => {
    gameRef.current?.setSandboxWeaponTier(tier);
  }, []);
  const handleSandboxSpawnEnemy = useCallback((kind: SandboxEnemyKind, count?: number) => {
    audio.unlock();
    gameRef.current?.spawnSandboxEnemy(kind, count);
  }, []);
  const handleSandboxDamage = useCallback((amount: number, headshot = false, all = false) => {
    audio.unlock();
    gameRef.current?.damageSandboxEnemies(amount, headshot, all);
  }, []);
  const handleSandboxPickup = useCallback((kind: PickupKind) => {
    audio.unlock();
    gameRef.current?.spawnSandboxPickup(kind);
  }, []);
  const handleSandboxFire = useCallback(() => {
    audio.unlock();
    gameRef.current?.fireSandboxWeapon();
  }, []);
  const handleSandboxRefill = useCallback(() => {
    audio.unlock();
    gameRef.current?.refillSandboxAmmo();
  }, []);
  const handleSandboxClear = useCallback(() => {
    audio.unlock();
    gameRef.current?.clearSandboxActors();
  }, []);
  const handlePickUpgrade = useCallback((id: string) => {
    audio.unlock();
    gameRef.current?.pickUpgrade(id);
  }, []);
  const handleReroll = useCallback(() => {
    audio.unlock();
    gameRef.current?.rerollUpgrades();
  }, []);
  const handleBanish = useCallback((id: string) => {
    audio.unlock();
    gameRef.current?.banishUpgrade(id);
  }, []);
  const handleMenu = useCallback(() => {
    clearCinematic();
    setRoomInUrl("");
    audio.setMusicMode("menu");
    setSandboxActive(false);
    setSandboxInUrl(false);
    gameRef.current?.returnToMenu();
  }, [clearCinematic, setRoomInUrl, setSandboxInUrl]);
  const handleBuyShop = useCallback((id: string) => {
    setShop((prev) => {
      const def = SHOP_BY_ID[id as ShopId];
      if (!def) return prev;
      const tier = prev.tiers[id] ?? 0;
      if (tier >= def.max) return prev;
      const cost = shopCost(def, tier);
      if (prev.gold < cost) return prev;
      const next: ShopState = { gold: prev.gold - cost, tiers: { ...prev.tiers, [id]: tier + 1 } };
      saveShop(next);
      gameRef.current?.setShopUpgrades(next.tiers);
      audio.unlock();
      audio.sfx("pickup");
      return next;
    });
  }, []);

  return (
    <div className="game-root fixed inset-0 w-screen h-screen" ref={containerRef}>
      <HUD
        state={hud}
        scores={scores}
        onLock={handleLock}
        onEscapeResume={handleEscapeResume}
        onRestart={handleRestart}
        onClearScores={handleClearScores}
        onStartMultiplayer={handleStartMultiplayer}
        onLeaveRoom={handleLeaveRoom}
        onStartSurvivors={handleStartSurvivors}
        onStartSandbox={sandboxAvailable ? handleStartSandbox : undefined}
        onPickUpgrade={handlePickUpgrade}
        onReroll={handleReroll}
        onBanish={handleBanish}
        onMenu={handleMenu}
        shop={shop}
        lastRunGold={lastRunGoldRef.current}
        onBuyShop={handleBuyShop}
        initialRoom={initialRoom}
        suppressMenu={sandboxActive}
      />
      <WarEffortBadge gameRef={gameRef} />
      {activeCinematic && (
        <CinematicOverlay
          beat={activeCinematic}
          site={cinematicAssignmentFor(activeArenaIdRef.current).site}
          onComplete={completeCinematic}
        />
      )}
      {sandboxActive && <GlobalMusicToggle className="ssg-music-toggle--corner" />}
      {SandboxPanel && sandboxActive && (
        <Suspense fallback={null}>
          <SandboxPanel
            state={hud}
            onStart={handleStartSandbox}
            onExit={handleExitSandbox}
            onLock={handleLock}
            onWeapon={handleSandboxWeapon}
            onWeaponTier={handleSandboxWeaponTier}
            onFire={handleSandboxFire}
            onRefill={handleSandboxRefill}
            onSpawnEnemy={handleSandboxSpawnEnemy}
            onDamage={handleSandboxDamage}
            onSpawnPickup={handleSandboxPickup}
            onClear={handleSandboxClear}
          />
        </Suspense>
      )}
      {combatAssetLoading && (
        <div
          data-testid="combat-asset-loading"
          role="status"
          aria-live="polite"
          className="pointer-events-auto absolute inset-0 z-50 flex cursor-wait items-center justify-center bg-[#070709]/90 px-6 text-center"
        >
          <div className="rounded-[9px] border border-[#ff6a00]/45 bg-black/70 px-7 py-6 shadow-[0_0_70px_rgba(255,106,0,0.18)]">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Preparing breach</div>
            <p className="mb-0 mt-2 text-[14px] text-[#e9e3d6]">Loading combat assets…</p>
          </div>
        </div>
      )}
      {combatAssetError && !combatAssetLoading && (
        <div
          data-testid="combat-asset-error"
          role="alert"
          className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[#070709]/90 px-6 text-center"
        >
          <div className="max-w-[520px] rounded-[9px] border border-[#c1121f]/65 bg-black/80 px-7 py-6">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff6a6a]">
              Combat assets failed to load
            </div>
            <p className="my-3 text-[13px] leading-relaxed text-[#e9e3d6]">{combatAssetError}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="rounded-[7px] border border-[#ff6a00]/65 bg-[#ff6a00]/15 px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#ffb26b]"
                onClick={() => {
                  audio.unlock();
                  const retry = combatRetryRef.current;
                  if (retry) void runCombatLaunch(retry);
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-[7px] border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#e9e3d6]"
                onClick={() => setCombatAssetError(undefined)}
              >
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
