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
import { getBannerSnapshot, subscribeBanner } from "./bannerBridge";
import { getPauseSnapshot, subscribePause } from "./pauseBridge";

export function AppShell() {
  const [showSettings, setShowSettings] = useState(false);
  const banner = useSyncExternalStore(subscribeBanner, getBannerSnapshot, getBannerSnapshot);
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
              {banner.gold}
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Wave</span>
            <span className="stat-value ssg-stat-value" id="stat-wave">
              {banner.wave}
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Base HP</span>
            <span className="stat-value ssg-stat-value" id="stat-hp">
              {banner.hp}
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Build</span>
            <span className="stat-value ssg-stat-value" id="stat-build">
              {banner.build}
            </span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Run</span>
            <span className="stat-value ssg-stat-value" id="stat-run">
              {banner.run}
            </span>
          </div>
        </div>

        <MainMenuScreen id="hud-banner" className={banner.visible ? undefined : "hidden"} backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="150 gold" aria-hidden>
            Ashgate lane
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>Scourge Lane Defense</MenuKicker>
              <MainMenuTitle id="banner-title">
                {banner.title === "DEADLANE" ? (
                  <>
                    <MainMenuTitleLine>DEAD</MainMenuTitleLine>
                    <MainMenuTitleLine tone="hot">LANE</MainMenuTitleLine>
                  </>
                ) : (
                  <MainMenuTitleLine tone="hot">{banner.title}</MainMenuTitleLine>
                )}
              </MainMenuTitle>
              <p id="banner-sub" className="ssg-main-menu-subtitle">
                {banner.subtitle}
              </p>
              <MainMenuStatus>
                <span>Run to the tile</span>
                <span>Build by hand</span>
                <span>Hold the base</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
                <MainMenuAction
                  id="banner-btn"
                  variant="primary"
                  label={banner.actionLabel}
                  meta={banner.actionMeta}
                />
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
          <span id="hint-text">{banner.hint}</span>
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
