import { codexEntriesForGame } from "@deadrot/game-kit";
import menuHero from "@shipshitgames/assets/games/deadlane/ui/menu/title.webp";
import {
  CodexScreen,
  GameJumpMenu,
  GameSettingsScreen,
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
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { unlockedBestiarySlugs } from "../codexUnlocks";
import { getBannerSnapshot, subscribeBanner } from "./bannerBridge";
import { getPauseSnapshot, subscribePause } from "./pauseBridge";

export function AppShell() {
  const [showSettings, setShowSettings] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  // Re-read the unlock set each time the codex opens so kills from the run
  // that just ended are reflected without any live bridge.
  const codexEntries = useMemo(
    () => (showCodex ? codexEntriesForGame("deadlane", { unlockedSlugs: unlockedBestiarySlugs() }) : []),
    [showCodex],
  );
  const banner = useSyncExternalStore(subscribeBanner, getBannerSnapshot, getBannerSnapshot);
  const pause = useSyncExternalStore(subscribePause, getPauseSnapshot, getPauseSnapshot);
  // The title <MainMenuScreen> is always mounted (visibility toggled via the
  // "hidden" class by the game engine), so the title is always "showing" here.
  const revealed = useEnterToReveal(true);
  const pauseStatus = useMemo(
    () => (
      <>
        <span>Hold the line</span>
        <span>Click resume to lock view</span>
      </>
    ),
    [],
  );
  const pauseActions = useMemo(
    () => [
      {
        id: "title",
        label: "Exit to title",
        meta: "Main menu",
        onSelect: () => pause.onExitToTitle?.(),
      },
    ],
    [pause.onExitToTitle],
  );

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
            <span className="stat-label ssg-stat-label">Tower [1-3]</span>
            <span className="stat-value ssg-stat-value ssg-stat-value--text" id="stat-tower">
              {banner.tower}
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
            {/* Nav stays mounted (engine grabs #banner-btn at boot); the splash
                gate only hides it until Enter/Space/click reveals the menu. */}
            <MainMenuNav aria-label="Main menu" hidden={!revealed}>
              <MainMenuAction id="banner-btn" variant="primary" label={banner.actionLabel} meta={banner.actionMeta} />
              <MainMenuAction variant="shop" label="Upgrades" meta="Tower tech" disabled />
              <MainMenuAction variant="coop" label="Co-op" meta="Solo command" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction
                type="button"
                variant="default"
                label="Codex"
                meta="War dossiers"
                onClick={() => setShowCodex(true)}
              />
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
              <GameJumpMenu currentSlug="deadlane" />
            </MainMenuNav>
            {!revealed && (
              <>
                <MainMenuEnterPrompt />
                <GameJumpMenu currentSlug="deadlane" className="ssg-game-jump--splash" />
              </>
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>

        <div id="hud-hint">
          <span id="hint-text">{banner.hint}</span>
        </div>
      </div>

      {showSettings && (
        <GameSettingsScreen
          open
          onClose={() => setShowSettings(false)}
          kicker="Wardens Console"
          backgroundImage={menuHero}
        />
      )}

      {showCodex && (
        <CodexScreen
          open
          onClose={() => setShowCodex(false)}
          kicker="Ashgate Lane"
          backgroundImage={menuHero}
          entries={codexEntries}
        />
      )}

      <PauseMenu
        open={pause.open}
        kicker="Ashgate Lane"
        title="Paused"
        subtitle="Re-enter the lane. The breach waits for no one."
        status={pauseStatus}
        onResume={() => pause.onResume?.()}
        resumeMeta="Lock view"
        actions={pauseActions}
      />
    </>
  );
}
