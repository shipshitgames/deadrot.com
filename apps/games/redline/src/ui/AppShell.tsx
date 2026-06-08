import menuHero from "@shipshitgames/assets/games/redline/ui/menu/title.webp";
import {
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
} from "@shipshitgames/ui";
import { GameOverlays } from "./overlays";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />

      <div id="speedlines" aria-hidden="true" />
      <div id="flash" aria-hidden="true" />
      <div id="vignette" aria-hidden="true" />

      <div id="hud">
        <div className="hud-corner hud-tl ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Speed</div>
          <div className="hud-value">
            <span id="hud-speed">0</span>
            <span className="hud-unit">u/s</span>
          </div>
        </div>

        <div className="hud-corner hud-tr ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Time</div>
          <div className="hud-value mono">
            <span id="hud-time">0.00</span>
          </div>
          <div className="hud-sub ssg-stat-sub">
            Best{" "}
            <span id="hud-best" className="mono">
              --.--
            </span>
          </div>
        </div>

        <div className="hud-corner hud-bl ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Distance</div>
          <div className="hud-value mono">
            <span id="hud-dist">0</span>
            <span className="hud-unit">m</span>
          </div>
        </div>

        <div className="hud-corner hud-br ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Lane</div>
          <div className="hud-value" id="hud-status">
            RUN
          </div>
        </div>

        <div id="progress">
          <div id="progress-fill" />
          <div id="progress-beacon">{"\u26eb"}</div>
        </div>
      </div>

      <MainMenuScreen id="overlay" backgroundImage={menuHero}>
        <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
          Beacon run
        </MainMenuTopBar>
        <MainMenuLayout id="overlay-card">
          <MainMenuCopy>
            <MenuKicker id="overlay-kicker">Pyre Courier Run</MenuKicker>
            <MainMenuTitle id="overlay-title">
              <MainMenuTitleLine>RED</MainMenuTitleLine>
              <MainMenuTitleLine tone="hot">LINE</MainMenuTitleLine>
            </MainMenuTitle>
            <p id="overlay-body" className="ssg-main-menu-subtitle">
              Carry the cargo through the Scourge-rot lane to the BEACON. Beat the clock.
            </p>
            <MainMenuStatus>
              <span>Courier ready</span>
              <span>Best time armed</span>
            </MainMenuStatus>
          </MainMenuCopy>
          <MainMenuNav aria-label="Main menu">
            <MainMenuAction id="overlay-btn" variant="primary" label="Ignite" meta="Run the lane" />
            <MainMenuAction variant="shop" label="Upgrades" meta="Cargo locked" disabled />
            <MainMenuAction variant="coop" label="Co-op" meta="Solo route" disabled />
            <MainMenuAction variant="records" label="Leaderboard" meta="Best time" disabled />
            <MainMenuAction variant="settings" label="Settings" meta="Audio" />
            <MainMenuAction variant="dev" label="Sandbox" meta="Route lab" disabled />
          </MainMenuNav>
        </MainMenuLayout>
        <GlobalMusicToggle className="ssg-music-toggle--corner" />
      </MainMenuScreen>

      <GameOverlays />
    </>
  );
}
