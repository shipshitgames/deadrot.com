import { GlobalMusicToggle, subscribeGlobalGameSettings } from "@shipshitgames/ui";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "./audio/AudioEngine";
import { HUD } from "./components/HUD";
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
  type MainWeaponVisualTier,
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
  loadSettings,
  loadShop,
  type ScoreEntry,
  type Settings,
  type ShopState,
  saveScore,
  saveShop,
} from "./game/storage";
import type { HUDState } from "./game/types";
import type { PlayerAvatarId } from "./net/playerAvatars";

const SandboxPanel = import.meta.env.DEV
  ? lazy(() => import("./components/SandboxPanel").then((mod) => ({ default: mod.SandboxPanel })))
  : null;

const INITIAL_WEAPON_IDENTITY = weaponIdentityFor(STARTING_WEAPON);

const INITIAL_STATE: HUDState = {
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
  hitMarkerSeq: 0,
  headshotSeq: 0,
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
  level: 1,
  xp: 0,
  xpToNext: xpForLevel(1),
  build: [],
  choices: [],
  rerolls: 0,
  banishes: 0,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const hudRef = useRef<HUDState>(INITIAL_STATE);
  const [hud, setHudState] = useState<HUDState>(INITIAL_STATE);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [settings] = useState<Settings>(() => loadSettings());
  const [shop, setShop] = useState<ShopState>(() => loadShop());
  const lastRunGoldRef = useRef(0);
  const sandboxAvailable = import.meta.env.DEV;
  const savedRef = useRef(false);
  // A shared link like `?room=BREACH-AB12` lands the player on the join screen.
  const initialRoom = useMemo(
    () => (new URLSearchParams(window.location.search).get("room") || "").toUpperCase().slice(0, 24),
    [],
  );
  const initialSandbox = useMemo(
    () => sandboxAvailable && new URLSearchParams(window.location.search).get("sandbox") === "1",
    [sandboxAvailable],
  );
  const [sandboxActive, setSandboxActive] = useState(initialSandbox);
  const setRoomInUrl = useCallback((room: string) => {
    const url = room ? `${window.location.pathname}?room=${encodeURIComponent(room)}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);
  const setSandboxInUrl = useCallback((active: boolean) => {
    const url = active ? `${window.location.pathname}?sandbox=1` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);
  const setHud = useCallback((next: HUDState) => {
    hudRef.current = next;
    setHudState(next);
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
    audio.setMusicEnabled(settings.music);
    audio.setSfxEnabled(settings.sfx);
    const game = new Game(container, setHud);
    gameRef.current = game;
    game.setShopUpgrades(shop.tiers);
    game.start();
    if (initialSandbox) game.startSandbox();
    if (import.meta.env.DEV) {
      (window as unknown as { __fpsGame?: Game; __fpsAudio?: typeof audio; __hudSnapshot?: () => HUDState }).__fpsGame =
        game;
      (window as unknown as { __fpsAudio?: typeof audio; __hudSnapshot?: () => HUDState }).__fpsAudio = audio;
      (window as unknown as { __hudSnapshot?: () => HUDState }).__hudSnapshot = () => hudRef.current;
    }
    return () => {
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record a run on the leaderboard (and award Survivors gold) once per game-over.
  useEffect(() => {
    if (hud.status === "gameover" && hud.outcome && !hud.sandbox && !savedRef.current) {
      savedRef.current = true;
      const earnedGold = hud.survivors ? runGold(hud.kills, hud.level, hud.time, shop.tiers.greed ?? 0) : 0;
      lastRunGoldRef.current = earnedGold;
      setScores(
        saveScore({
          score: hud.score,
          kills: hud.kills,
          headshots: hud.headshots,
          time: hud.time,
          outcome: hud.outcome,
          mode: hud.runMode,
          level: hud.level,
          depthReached: hud.runDepth,
          depthTotal: hud.runDepthTotal,
          depthName: hud.runDepthName,
          goldEarned: earnedGold,
          date: Date.now(),
        }),
      );
      if (hud.survivors) {
        setShop((prev) => {
          const next = { ...prev, gold: prev.gold + earnedGold };
          saveShop(next);
          return next;
        });
      } else {
        lastRunGoldRef.current = 0;
      }
    } else if (hud.status !== "gameover") {
      savedRef.current = false;
      lastRunGoldRef.current = 0;
    }
  }, [
    hud.status,
    hud.outcome,
    hud.score,
    hud.kills,
    hud.headshots,
    hud.time,
    hud.survivors,
    hud.level,
    hud.sandbox,
    hud.runMode,
    hud.runDepth,
    hud.runDepthTotal,
    hud.runDepthName,
    shop.tiers.greed,
  ]);

  const handleLock = useCallback(() => {
    audio.unlock();
    gameRef.current?.requestLock();
  }, []);
  const handleRestart = useCallback(() => {
    audio.unlock();
    gameRef.current?.restart();
  }, []);
  const handleClearScores = useCallback(() => setScores(clearScores()), []);
  const handleStartMultiplayer = useCallback(
    (name: string, room: string, avatar: PlayerAvatarId) => {
      audio.unlock();
      audio.setMusicMode("multiplayer");
      setSandboxActive(false);
      setSandboxInUrl(false);
      setRoomInUrl(room);
      gameRef.current?.startMultiplayer(room, name, avatar);
    },
    [setRoomInUrl, setSandboxInUrl],
  );
  const handleLeaveRoom = useCallback(() => {
    setRoomInUrl("");
    audio.setMusicMode("menu");
    gameRef.current?.leaveMultiplayer(true);
  }, [setRoomInUrl]);
  const handleStartSurvivors = useCallback(
    (classId?: SurvivorClassId) => {
      audio.unlock();
      audio.setMusicMode("survivors");
      setSandboxActive(false);
      setSandboxInUrl(false);
      gameRef.current?.startSurvivors(classId);
    },
    [setSandboxInUrl],
  );
  const handleStartSandbox = useCallback(
    (mapId?: string) => {
      if (!sandboxAvailable) return;
      audio.unlock();
      setRoomInUrl("");
      setSandboxActive(true);
      setSandboxInUrl(true);
      gameRef.current?.startSandbox(mapId);
    },
    [sandboxAvailable, setRoomInUrl, setSandboxInUrl],
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
    setRoomInUrl("");
    audio.setMusicMode("menu");
    setSandboxActive(false);
    setSandboxInUrl(false);
    gameRef.current?.returnToMenu();
  }, [setRoomInUrl, setSandboxInUrl]);
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
    </div>
  );
}
