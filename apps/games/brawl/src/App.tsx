import "@shipshitgames/ui/styles.css";
import { codexEntriesForGame } from "@deadrot/game-kit";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import menuHero from "@shipshitgames/assets/games/brawl/ui/menu/title.webp";
import {
  CodexScreen,
  GameAudioSettingsScreen,
  GamePauseMenu,
  GlobalMusicToggle,
  gameMenuConfig,
  type PauseMenuAction,
} from "@shipshitgames/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game } from "./game/Game";
import { DEFAULT_PLAYER_ID, type FighterId, fighterById } from "./game/roster";
import type { GameMode, HudState, InputAction } from "./game/types";
import { ArenaScoreboard } from "./ui/ArenaScoreboard";
import { DuelHud } from "./ui/DuelHud";
import { ResultPanel } from "./ui/ResultPanel";
import { SelectPanel } from "./ui/SelectPanel";
import { TouchControls } from "./ui/TouchControls";
import "./styles.css";

void initDeadrotBrowserTelemetry({ game: "brawl", env: import.meta.env });

const GAME_SLUG = "brawl";
const menu = gameMenuConfig(GAME_SLUG);
const CODEX_ENTRIES = codexEntriesForGame(GAME_SLUG);

const INITIAL_HUD: HudState = {
  status: "select",
  mode: "duel",
  selectedId: DEFAULT_PLAYER_ID,
  arenaSlots: 3,
  opponentId: null,
  timer: 60,
  player: null,
  opponent: null,
  arena: null,
  result: null,
  hits: 0,
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const selected = useMemo(() => fighterById(hud.selectedId), [hud.selectedId]);
  const opponent = hud.opponentId ? fighterById(hud.opponentId) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameRef.current) return;
    const game = new Game(canvas, setHud);
    gameRef.current = game;
    if (import.meta.env.DEV) {
      const win = window as unknown as {
        __brawlGame?: Game;
        __brawlSnapshot?: () => ReturnType<Game["debugSnapshot"]>;
      };
      win.__brawlGame = game;
      win.__brawlSnapshot = () => game.debugSnapshot();
    }
    game.start();
    return () => {
      game.dispose();
      if (import.meta.env.DEV) {
        const win = window as unknown as {
          __brawlGame?: Game;
          __brawlSnapshot?: () => ReturnType<Game["debugSnapshot"]>;
        };
        if (win.__brawlGame === game) {
          delete win.__brawlGame;
          delete win.__brawlSnapshot;
        }
      }
      gameRef.current = null;
    };
  }, []);

  const choose = (id: FighterId) => gameRef.current?.selectFighter(id);
  const setMode = (mode: GameMode) => gameRef.current?.setMode(mode);
  const setSlots = (slots: number) => gameRef.current?.setArenaSlots(slots);
  const start = () => {
    if (hud.mode === "arena") gameRef.current?.startArena(hud.selectedId, hud.arenaSlots);
    else gameRef.current?.startFight(hud.selectedId);
  };
  const command = (action: InputAction) => gameRef.current?.command(action);
  const hold = (action: InputAction, pressed: boolean) => gameRef.current?.setVirtual(action, pressed);
  const openSettings = useCallback(() => {
    gameRef.current?.setMenuOverlayOpen(true);
    setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    gameRef.current?.setMenuOverlayOpen(false);
  }, []);
  const openCodex = useCallback(() => {
    gameRef.current?.setMenuOverlayOpen(true);
    setCodexOpen(true);
  }, []);
  const closeCodex = useCallback(() => {
    setCodexOpen(false);
    gameRef.current?.setMenuOverlayOpen(false);
  }, []);
  const pauseActions = useMemo<PauseMenuAction[]>(
    () => [
      { id: "restart", label: "Restart match", meta: "Fresh bell", onSelect: () => gameRef.current?.rematch() },
      { id: "settings", label: "Settings", meta: "Audio and effects", variant: "settings", onSelect: openSettings },
      { id: "codex", label: "Codex", meta: "War dossiers", onSelect: openCodex },
      { id: "roster", label: "Roster", meta: "Character select", onSelect: () => gameRef.current?.returnToRoster() },
    ],
    [openCodex, openSettings],
  );

  return (
    <main className="brawl-shell">
      <canvas ref={canvasRef} className="brawl-canvas" aria-label="Brawl battlefield" data-testid="brawl-canvas" />

      {hud.mode === "arena" && hud.arena ? (
        <ArenaScoreboard arena={hud.arena} timer={hud.timer} />
      ) : (
        <DuelHud
          player={hud.player}
          opponent={hud.opponent}
          timer={hud.timer}
          selectedName={selected.name}
          selectedFaction={selected.faction}
          opponentName={opponent?.name ?? "Rival"}
          opponentFaction={opponent?.faction ?? "Auto"}
        />
      )}

      {hud.status === "select" && (
        <SelectPanel
          mode={hud.mode}
          selectedId={hud.selectedId}
          arenaSlots={hud.arenaSlots}
          selectedFaction={selected.faction}
          onMode={setMode}
          onSlots={setSlots}
          onChoose={choose}
          onStart={start}
          onSettings={openSettings}
          onCodex={openCodex}
        />
      )}

      {hud.status === "round-over" && hud.result && (
        <ResultPanel
          result={hud.result}
          mode={hud.mode}
          arena={hud.arena}
          onRematch={() => gameRef.current?.rematch()}
          onRoster={() => gameRef.current?.returnToRoster()}
        />
      )}

      {hud.status === "playing" && (
        <>
          <button
            className="brawl-pause-button"
            type="button"
            aria-label="Pause"
            onClick={() => gameRef.current?.pause()}
          >
            II
          </button>
          <TouchControls onCommand={command} onHold={hold} />
        </>
      )}

      {hud.status === "select" && <GlobalMusicToggle className="ssg-music-toggle--corner" />}

      <GamePauseMenu
        slug={GAME_SLUG}
        open={hud.status === "paused"}
        backgroundImage={menuHero}
        status={
          <>
            <span>{hud.mode === "arena" ? `${hud.arenaSlots}-fighter arena` : "One-on-one duel"}</span>
            <span>{hud.timer}s on the clock</span>
          </>
        }
        onResume={() => gameRef.current?.resume()}
        resumeMeta="Return to the clash"
        actions={pauseActions}
      />

      {settingsOpen && (
        <GameAudioSettingsScreen
          open
          slug={GAME_SLUG}
          backgroundImage={menuHero}
          sliderKeys={["music", "sound", "particles", "shake"]}
          onClose={closeSettings}
        />
      )}

      {codexOpen && (
        <CodexScreen
          open
          backgroundImage={menuHero}
          kicker={menu.codexKicker}
          entries={CODEX_ENTRIES}
          onClose={closeCodex}
        />
      )}
    </main>
  );
}
