import menuHero from "@shipshitgames/assets/games/rothulk/ui/menu/title.webp";
import {
  GlobalGameSettingsPanel,
  GlobalMusicToggle,
  goToWarlineLobby,
  MainMenuAction,
  MainMenuCopy,
  MainMenuEnterPrompt,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTitle,
  MainMenuTitleLine,
  MainMenuTopBar,
  MenuKicker,
  PauseMenu,
  useEnterToReveal,
} from "@shipshitgames/ui";
import { useEffect, useRef, useState } from "react";
import type { Game } from "../game/Game";

interface AppShellProps {
  createGame: (canvas: HTMLCanvasElement) => Game;
}

export function AppShell({ createGame }: AppShellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const revealed = useEnterToReveal(!started);

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
              REACH + IGNITE THE CORE
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
            Pyre infiltration
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>Pyre Infiltration</MenuKicker>
              <MainMenuTitle className="banner-title">
                <MainMenuTitleLine>ROT</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">HULK</MainMenuTitleLine>
              </MainMenuTitle>
              <MenuKicker className="banner-sub">
                Climb the living Scourge hulk. Ignite the breach-core. Escape the severed node.
              </MenuKicker>
              <MainMenuStatus>
                <span>Boarding spike armed</span>
                <span>Core at crown</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
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
                  label="← Back to Warline"
                  meta="Lobby"
                  onClick={() => goToWarlineLobby()}
                />
              </MainMenuNav>
            ) : (
              <MainMenuEnterPrompt />
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>
      )}

      {showSettings && (
        <MainMenuScreen
          className="rothulk-settings-screen"
          backgroundImage={menuHero}
          style={{ position: "fixed", inset: 0, zIndex: 90 }}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>{"The Pyre // Console"}</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine tone="hot">Settings</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle">Tune the music and effect levels for the breach.</p>
              <GlobalGameSettingsPanel inline />
            </MainMenuCopy>
            <MainMenuNav aria-label="Settings menu">
              <MainMenuAction
                type="button"
                variant="primary"
                label="Back"
                meta={paused ? "Paused" : started ? "Resume" : "Main menu"}
                onClick={() => setShowSettings(false)}
              />
            </MainMenuNav>
          </MainMenuLayout>
        </MainMenuScreen>
      )}

      <PauseMenu
        open={paused}
        kicker="Pyre Infiltration"
        title="Paused"
        subtitle="The hulk stirs while you hold. Resume the breach when ready."
        status={
          <>
            <span>Core at crown</span>
            <span>Embers held</span>
          </>
        }
        onResume={() => gameRef.current?.resume()}
        actions={[
          {
            id: "settings",
            label: "Settings",
            meta: "Audio",
            variant: "settings",
            onSelect: () => setShowSettings(true),
          },
          {
            id: "restart",
            label: "Restart run",
            meta: "New breach",
            onSelect: () => gameRef.current?.restart(),
          },
        ]}
      />

      <div id="toast" className="toast" />
    </>
  );
}
