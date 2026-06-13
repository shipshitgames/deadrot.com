import menuHero from "@shipshitgames/assets/games/rothulk/ui/menu/title.webp";
import {
  GameAudioSettingsScreen,
  GameJumpMenu,
  GameMenuTitle,
  GamePauseMenu,
  GlobalMusicToggle,
  gameMenuConfig,
  goToWarlineLobby,
  MainMenuAction,
  MainMenuCopy,
  MainMenuEnterPrompt,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTopBar,
  MenuKicker,
  useEnterToReveal,
} from "@shipshitgames/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { objectiveForPhase } from "../game/coreLoop";
import type { Game } from "../game/Game";

interface AppShellProps {
  createGame: (canvas: HTMLCanvasElement) => Game;
}

const GAME_SLUG = "rothulk";
const menu = gameMenuConfig(GAME_SLUG);

export function AppShell({ createGame }: AppShellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const revealed = useEnterToReveal(!started);
  const pauseStatus = useMemo(
    () => (
      <>
        <span>Core at crown</span>
        <span>Embers held</span>
      </>
    ),
    [],
  );
  const pauseActions = useMemo(
    () => [
      {
        id: "settings",
        label: "Settings",
        meta: "Audio",
        variant: "settings" as const,
        onSelect: () => setShowSettings(true),
      },
      {
        id: "restart",
        label: "Restart run",
        meta: "New breach",
        onSelect: () => gameRef.current?.restart(),
      },
    ],
    [],
  );

  // Build the Game once the canvas is mounted, and mirror its paused flag into
  // React (Esc inside the canvas toggles it).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameRef.current) return;
    const game = createGame(canvas);
    gameRef.current = game;
    game.onPauseChange = setPaused;
    return () => {
      game.onPauseChange = null;
    };
  }, [createGame]);

  // Esc pauses/resumes during an active run; also closes the settings overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      // Esc always closes the settings overlay first — even on the title screen.
      if (showSettings) {
        e.preventDefault();
        setShowSettings(false);
        return;
      }
      if (!started) return;
      e.preventDefault();
      gameRef.current?.togglePause();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [started, showSettings]);

  const beginRun = () => {
    setStarted(true);
    gameRef.current?.beginRun();
  };

  return (
    <>
      <canvas id="scene" ref={canvasRef} />

      <div id="hud" aria-hidden="true">
        <div className="hud-top">
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Lives</span>
            <span className="hud-value ssg-stat-value" id="hud-lives">
              x3
            </span>
          </div>
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Integrity</span>
            <div className="hp-bar">
              <div className="hp-fill" id="hud-hp" />
            </div>
          </div>
          <div className="hud-block hud-grow ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Objective</span>
            <span className="hud-value hud-obj" id="hud-obj">
              {objectiveForPhase("infiltrate", false)}
            </span>
          </div>
          <div className="hud-block hud-right ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Hulk Depth</span>
            <div className="progress">
              <div className="progress-fill" id="hud-progress" />
            </div>
          </div>
        </div>

        <div className="hud-bottom">
          <span className="hud-faction">{"THE PYRE // INFILTRATION"}</span>
          <span className="hud-embers">
            EMBERS <b id="hud-embers">0</b>
          </span>
        </div>
      </div>

      {!started && (
        <MainMenuScreen id="banner" className="banner" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
            {menu.topBar}
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>{menu.titleKicker}</MenuKicker>
              <GameMenuTitle config={menu} />
              <p className="ssg-main-menu-subtitle">{menu.titleSubtitle}</p>
              <MainMenuStatus>
                {menu.titleStatus.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </MainMenuStatus>
            </MainMenuCopy>
            {/* Nav stays mounted; the splash gate only hides it until
                Enter/Space/click reveals the menu. */}
            <MainMenuNav aria-label="Main menu" hidden={!revealed}>
              <MainMenuAction
                id="start-btn"
                type="button"
                variant="primary"
                label="Breach the Hulk"
                meta="Begin run"
                onClick={beginRun}
              />
              <MainMenuAction variant="shop" label="Upgrades" meta="Core locked" disabled />
              <MainMenuAction variant="coop" label="Co-op" meta="Solo breach" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction
                type="button"
                variant="settings"
                label="Settings"
                meta="Audio"
                onClick={() => setShowSettings(true)}
              />
              <MainMenuAction variant="dev" label="Sandbox" meta="Hulk lab" disabled />
              <MainMenuAction
                type="button"
                variant="default"
                label={menu.backToWarlineLabel}
                meta={menu.backToWarlineMeta}
                onClick={() => goToWarlineLobby()}
              />
              <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} />
            </MainMenuNav>
            {!revealed && (
              <>
                <MainMenuEnterPrompt />
                <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} className="ssg-game-jump--splash" />
              </>
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>
      )}

      {showSettings && (
        <GameAudioSettingsScreen
          open
          slug={GAME_SLUG}
          onClose={() => setShowSettings(false)}
          backgroundImage={menuHero}
        />
      )}

      <GamePauseMenu
        slug={GAME_SLUG}
        open={paused}
        status={pauseStatus}
        onResume={() => gameRef.current?.resume()}
        actions={pauseActions}
      />

      <div id="toast" className="toast" />
    </>
  );
}
