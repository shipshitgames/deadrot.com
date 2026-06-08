import {
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
import menuHero from "@shipshitgames/assets/games/deadlane/ui/menu/title.webp";

export function AppShell() {
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
          <MainMenuLayout>
            <MainMenuCopy>
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
            <MainMenuNav aria-label="Main menu">
              <MainMenuAction id="banner-btn" variant="primary" label="Deploy" meta="Start wave" />
              <MainMenuAction variant="shop" label="Upgrades" meta="Tower tech" disabled />
              <MainMenuAction variant="coop" label="Co-op" meta="Solo command" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction variant="settings" label="Settings" meta="Build grid" disabled />
              <MainMenuAction variant="dev" label="Sandbox" meta="Lane lab" disabled />
            </MainMenuNav>
          </MainMenuLayout>
        </MainMenuScreen>

        <div id="hud-hint">
          <span id="hint-text">CLICK A CELL TO BUILD (COST 50)</span>
        </div>
      </div>
    </>
  );
}
