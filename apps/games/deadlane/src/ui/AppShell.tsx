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
  MenuKicker,
} from "@shipshitgames/ui";

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
        </div>

        <MainMenuScreen id="hud-banner" className="hidden ssg-main-menu-screen--compact">
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>Scourge Lane Defense</MenuKicker>
              <MainMenuTitle id="banner-title">DEADLANE</MainMenuTitle>
              <p id="banner-sub" className="ssg-main-menu-subtitle" />
              <MainMenuStatus>
                <span>Build the kill corridor</span>
                <span>Hold the base</span>
              </MainMenuStatus>
            </MainMenuCopy>
            <MainMenuNav label="Command">
              <MainMenuAction id="banner-btn" variant="primary" label="DEPLOY" meta="Start wave" />
              <GlobalMusicToggle />
              <GlobalGameSettingsPanel inline />
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
