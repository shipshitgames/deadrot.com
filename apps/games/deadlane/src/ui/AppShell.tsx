import { Button, MenuPanel, MenuScreen, MenuTitle } from "@shipshitgames/ui";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />
      <div id="hud">
        <div id="hud-top">
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Gold</span>
            <span className="stat-value ssg-stat-value" id="stat-gold">0</span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Wave</span>
            <span className="stat-value ssg-stat-value" id="stat-wave">0 / 0</span>
          </div>
          <div className="stat ssg-hud-corner">
            <span className="stat-label ssg-stat-label">Base HP</span>
            <span className="stat-value ssg-stat-value" id="stat-hp">0</span>
          </div>
        </div>

        <MenuScreen id="hud-banner" className="hidden">
          <MenuPanel>
            <MenuTitle id="banner-title">DEADLANE</MenuTitle>
            <p id="banner-sub" />
            <Button id="banner-btn" variant="primary" size="lg">
              DEPLOY
            </Button>
          </MenuPanel>
        </MenuScreen>

        <div id="hud-hint">
          <span id="hint-text">CLICK A CELL TO BUILD (COST 50)</span>
        </div>
      </div>
    </>
  );
}
