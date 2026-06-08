import menuHero from "@shipshitgames/assets/games/pactfall/ui/menu/title.webp";
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
import { useEffect, useState } from "react";
import type { Game } from "../game/Game";
import type { Phase } from "../game/types";
import { getBridgeGame, subscribeBridgeGame } from "./gameBridge";

export function AppShell() {
  // The vanilla Game owns the loop + HUD DOM; it registers itself on the bridge
  // once main.ts has spun it up. We only need it to drive pause/resume.
  const [game, setGame] = useState<Game | null>(() => getBridgeGame());
  const [phase, setPhase] = useState<Phase>(() => getBridgeGame()?.phase ?? "title");
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Splash gate: the title nav only appears once the player presses Enter/Space/clicks.
  // Re-arms each time the match returns to the title phase.
  const revealed = useEnterToReveal(phase === "title");

  useEffect(() => subscribeBridgeGame(setGame), []);

  // Mirror the Game's phase into React so the pause overlay only arms during a
  // live match and drops the instant a match resolves.
  useEffect(() => {
    if (!game) return;
    setPhase(game.phase);
    game.onPhaseChange = (next) => {
      setPhase(next);
      if (next !== "playing") {
        setPaused(false);
        setShowSettings(false);
      }
    };
    return () => {
      game.onPhaseChange = null;
    };
  }, [game]);

  // Esc toggles pause, but only while a match is actually in play.
  useEffect(() => {
    if (!game) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (game.phase !== "playing") return;
      event.preventDefault();
      // Esc closes the settings panel first (back to the pause menu), only then toggles pause.
      if (showSettings) {
        setShowSettings(false);
        return;
      }
      setPaused((prev) => {
        const next = !prev;
        if (next) game.pause();
        else game.resume();
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, showSettings]);

  const resume = () => {
    game?.resume();
    setPaused(false);
    setShowSettings(false);
  };

  const restart = () => {
    setPaused(false);
    setShowSettings(false);
    game?.beginRun();
  };

  return (
    <>
      <canvas id="scene" />
      <div id="hud">
        <div id="arena-name" />
        <div id="hud-top">
          <div className="meter" id="meter-base-friendly">
            <span className="meter-label">PYRE BASE</span>
            <div className="bar">
              <i />
            </div>
          </div>
          <div className="meter" id="meter-base-enemy">
            <span className="meter-label">WARDEN BASE</span>
            <div className="bar bar--enemy">
              <i />
            </div>
          </div>
        </div>

        <div id="hud-bottom">
          <div className="meter meter--wide" id="meter-hp">
            <span className="meter-label">CHAMPION HP</span>
            <div className="bar bar--hp">
              <i />
            </div>
          </div>
          <div id="buff" className="buff buff--off">
            <span className="buff-label">SCOURGE BUFF</span>
            <span className="buff-time">-</span>
          </div>
        </div>

        <div id="hint">WASD / TAP TO MOVE - AUTO-ATTACKS NEAREST - KILL THE SCOURGE FOR A BUFF</div>

        <MainMenuScreen id="title-screen" className="banner" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
            Broken concord
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>Pyre vs Warden Arena</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine>PACT</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">FALL</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle">
                Break the Warden base before the Scourge turns the duel into a feeding ground.
              </p>
              <MainMenuStatus>
                <span>Champion armed</span>
                <span>Neutral Scourge buff</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
                <MainMenuAction id="title-start-btn" variant="primary" label="Enter arena" meta="Begin duel" />
                <MainMenuAction variant="shop" label="Upgrades" meta="Champion locked" disabled />
                <MainMenuAction variant="coop" label="Co-op" meta="Local duel" disabled />
                <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
                <MainMenuAction
                  type="button"
                  variant="settings"
                  label="Settings"
                  meta="Audio"
                  onClick={() => setShowSettings(true)}
                />
                <MainMenuAction variant="dev" label="Sandbox" meta="Arena lab" disabled />
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

        <MainMenuScreen id="banner" className="banner banner--hidden" backgroundImage={menuHero}>
          <MainMenuLayout>
            <MainMenuCopy>
              <MainMenuTitle className="banner-title" />
              <MenuKicker className="banner-sub">PRESS R OR CLICK TO REDEPLOY</MenuKicker>
            </MainMenuCopy>
          </MainMenuLayout>
        </MainMenuScreen>
      </div>

      {showSettings && (
        <MainMenuScreen className="banner" backgroundImage={menuHero} style={{ position: "fixed", zIndex: 90 }}>
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>Arena Settings</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine>AUDIO</MainMenuTitleLine>
              </MainMenuTitle>
              <GlobalGameSettingsPanel inline />
            </MainMenuCopy>
            <MainMenuNav aria-label="Settings">
              <MainMenuAction
                type="button"
                variant="primary"
                label="Back"
                meta="Title menu"
                onClick={() => setShowSettings(false)}
              />
            </MainMenuNav>
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>
      )}

      <PauseMenu
        open={paused && phase === "playing" && !showSettings}
        kicker="Ashgate Arena"
        title="Paused"
        subtitle="The duel holds. Catch your breath, then redeploy."
        status={
          <>
            <span>Champion armed</span>
            <span>Scourge prowling</span>
          </>
        }
        onResume={resume}
        actions={[
          { id: "restart", label: "Redeploy", meta: "Restart duel", onSelect: restart },
          {
            id: "settings",
            label: "Settings",
            meta: "Audio",
            variant: "settings",
            onSelect: () => setShowSettings(true),
          },
        ]}
      />
    </>
  );
}
