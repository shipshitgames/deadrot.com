import menuHero from "@shipshitgames/assets/games/starblight/ui/menu/title.webp";
import {
  GlobalGameSettingsPanel,
  GlobalMusicToggle,
  MainMenuAction,
  MainMenuCopy,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTitle,
  MainMenuTitleLine,
  MainMenuTopBar,
  MenuKicker,
  MenuPanel,
  PauseMenu,
} from "@shipshitgames/ui";
import { useState, useSyncExternalStore } from "react";
import { getPauseActions, getPauseSnapshot, subscribePause } from "./gameBridge";

export function AppShell() {
  // Pause state lives in the imperative Game engine; mirror it here via the
  // bridge so the shared React PauseMenu can render over the canvas.
  const pause = useSyncExternalStore(subscribePause, getPauseSnapshot, getPauseSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <canvas id="scene" />

      <div id="hud">
        <div className="hud-top">
          <div className="level-badge">
            LVL{" "}
            <span id="level" className="mono">
              1
            </span>
          </div>
          <div className="xpbar">
            <div id="xp-fill" />
          </div>
          <div className="top-right">
            <button id="pause-btn" className="pause-btn hidden" aria-label="Pause" type="button">
              <span className="pause-glyph" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
            <span id="salvage" className="mono">
              0
            </span>
            <span className="salvage-icon">{"\u25c6"}</span>
            <span id="kills" className="kills">
              0 kills
            </span>
          </div>
        </div>
        <div id="timer" className="mono">
          0:00
        </div>
        <div id="boss-bar" className="hidden">
          <span className="boss-name">THE BLIGHT-MAW</span>
          <div className="boss-track">
            <div id="boss-fill" />
          </div>
        </div>

        <div className="hud-bottomleft">
          <div className="intbar">
            <span className="label">Integrity</span>
            <div className="int-track">
              <div id="int-fill" />
            </div>
            <span id="int-text" className="mono">
              100/100
            </span>
          </div>
          <div id="build-tray" />
        </div>

        <MainMenuScreen id="banner" className="banner" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="0 salvage" aria-hidden>
            Orbital front
          </MainMenuTopBar>
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>Orbital Survivors Front</MenuKicker>
              <MainMenuTitle id="banner-title">
                <MainMenuTitleLine>STAR</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">BLIGHT</MainMenuTitleLine>
              </MainMenuTitle>
              <MenuKicker id="banner-sub">THE ORBITAL FRONT</MenuKicker>
              <p className="hint" id="banner-hint">
                MOVE WITH THE MOUSE - weapons auto-fire - collect gems, draft upgrades, stack combos
              </p>
              <MainMenuStatus>
                <span>Interceptor online</span>
                <span>Draft systems hot</span>
              </MainMenuStatus>
            </MainMenuCopy>
            <MainMenuNav aria-label="Main menu">
              <MainMenuAction id="banner-btn" variant="primary" label="Engage" meta="Start sortie" />
              <MainMenuAction variant="shop" label="Upgrades" meta="Draft only" disabled />
              <MainMenuAction variant="coop" label="Co-op" meta="Solo sortie" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction
                type="button"
                variant="settings"
                label="Settings"
                meta="Audio"
                onClick={() => setSettingsOpen(true)}
              />
              <MainMenuAction variant="dev" label="Sandbox" meta="Orbit lab" disabled />
            </MainMenuNav>
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>

        <PauseMenu
          open={pause.open}
          kicker="Orbital Front"
          title="Paused"
          subtitle="The Scourge holds at the threshold while you stand down."
          status={<span>{pause.stats}</span>}
          onResume={() => getPauseActions().resume()}
          actions={[
            { id: "restart", label: "Restart run", meta: "New sortie", onSelect: () => getPauseActions().restart() },
            { id: "title", label: "Main menu", meta: "Exit to title", onSelect: () => getPauseActions().title() },
          ]}
        />

        {settingsOpen && (
          <div className="settings-overlay">
            <MenuPanel className="settings-inner">
              <h2 className="settings-title ssg-section-heading">SETTINGS</h2>
              <GlobalGameSettingsPanel inline />
              <button type="button" className="menu-action settings-close" onClick={() => setSettingsOpen(false)}>
                CLOSE
              </button>
            </MenuPanel>
          </div>
        )}

        <div id="draft" className="draft hidden">
          <MenuPanel className="draft-inner">
            <h2 className="draft-head ssg-section-heading">CHOOSE AN UPGRADE</h2>
            <div id="draft-cards" className="draft-cards" />
            <p className="draft-hint">Click a card - or press 1 / 2 / 3</p>
          </MenuPanel>
        </div>

        <div id="flash" />
        <div id="vignette" />
      </div>
    </>
  );
}
