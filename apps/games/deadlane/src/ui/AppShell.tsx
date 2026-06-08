import menuHero from "@shipshitgames/assets/games/deadlane/ui/menu/title.webp";
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
import { useEffect, useState, useSyncExternalStore } from "react";
import { getPauseSnapshot, subscribePause } from "./pauseBridge";

export function AppShell() {
  const [showSettings, setShowSettings] = useState(false);
  const pause = useSyncExternalStore(subscribePause, getPauseSnapshot, getPauseSnapshot);
  // The title <MainMenuScreen> is always mounted (visibility toggled via the
  // "hidden" class by the game engine), so the title is always "showing" here.
  const revealed = useEnterToReveal(true);

  // Esc closes the settings overlay so the player is never trapped in it.
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  return (
    <>
      <canvas id="scene" />
      <div id="hud">
        <div id="hud-top">
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Gold</span>
            <span className="stat-value ssg-stat-value" id="stat-gold">
              0
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Wave</span>
            <span className="stat-value ssg-stat-value" id="stat-wave">
              0 / 0
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Base HP</span>
            <span className="stat-value ssg-stat-value" id="stat-hp">
              0
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Build</span>
            <span className="stat-value ssg-stat-value" id="stat-build">
              100%
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Run</span>
            <span className="stat-value ssg-stat-value" id="stat-run">
              100%
            </span>
          </div>
        </div>

        <MainMenuScreen id="hud-banner" className="hidden" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="150 gold" aria-hidden>
            Ashgate lane
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>Scourge Lane Defense</MenuKicker>
              <MainMenuTitle id="banner-title">
                <MainMenuTitleLine>DEAD</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">LANE</MainMenuTitleLine>
              </MainMenuTitle>
              <p id="banner-sub" className="ssg-main-menu-subtitle" />
              <MainMenuStatus>
                <span>Run to the tile</span>
                <span>Build by hand</span>
                <span>Hold the base</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
                <MainMenuAction id="banner-btn" variant="primary" label="Deploy" meta="Start wave" />
                <MainMenuAction variant="shop" label="Upgrades" meta="Tower tech" disabled />
                <MainMenuAction variant="coop" label="Co-op" meta="Solo command" disabled />
                <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
                <MainMenuAction
                  type="button"
                  variant="settings"
                  label="Settings"
                  meta="Audio"
                  onClick={() => setShowSettings(true)}
                />
                <MainMenuAction variant="dev" label="Sandbox" meta="Lane lab" disabled />
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

        <div id="hud-hint">
          <span id="hint-text">CLICK A CELL TO BUILD (COST 50)</span>
        </div>
      </div>

      {showSettings && (
        <MainMenuScreen
          className="deadlane-settings-screen"
          backgroundImage={menuHero}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>Wardens Console</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine tone="hot">Settings</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle">Tune the music and battle SFX for the lane.</p>
              <GlobalGameSettingsPanel inline />
            </MainMenuCopy>
            <MainMenuNav aria-label="Settings menu">
              <MainMenuAction
                type="button"
                variant="primary"
                label="Back"
                meta="Main menu"
                onClick={() => setShowSettings(false)}
              />
            </MainMenuNav>
          </MainMenuLayout>
        </MainMenuScreen>
      )}

      <PauseMenu
        open={pause.open}
        kicker="Ashgate Lane"
        title="Paused"
        subtitle="Re-enter the lane. The breach waits for no one."
        status={
          <>
            <span>Hold the line</span>
            <span>Click resume to lock view</span>
          </>
        }
        onResume={() => pause.onResume?.()}
        resumeMeta="Lock view"
        actions={[
          {
            id: "title",
            label: "Exit to title",
            meta: "Main menu",
            onSelect: () => pause.onExitToTitle?.(),
          },
        ]}
      />
    </>
  );
}
