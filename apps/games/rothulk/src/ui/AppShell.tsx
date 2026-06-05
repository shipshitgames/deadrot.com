import { Button, MenuKicker, MenuPanel, MenuScreen, MenuTitle } from "@shipshitgames/ui";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />

      <div id="hud" aria-hidden="true">
        <div className="hud-top">
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Lives</span>
            <span className="hud-value ssg-stat-value" id="hud-lives">x3</span>
          </div>
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Integrity</span>
            <div className="hp-bar"><div className="hp-fill" id="hud-hp" /></div>
          </div>
          <div className="hud-block hud-grow ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Objective</span>
            <span className="hud-value hud-obj" id="hud-obj">REACH + IGNITE THE CORE</span>
          </div>
          <div className="hud-block hud-right ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Hulk Depth</span>
            <div className="progress"><div className="progress-fill" id="hud-progress" /></div>
          </div>
        </div>

        <div className="hud-bottom">
          <span className="hud-faction">THE PYRE // INFILTRATION</span>
          <span className="hud-embers">EMBERS <b id="hud-embers">0</b></span>
        </div>
      </div>

      <MenuScreen id="banner" className="banner">
        <MenuPanel className="banner-inner">
          <MenuTitle className="banner-title">ROTHULK</MenuTitle>
          <MenuKicker className="banner-sub">
            Run the rotting Scourge hulk. Stomp the horde. Ignite the breach-core.
          </MenuKicker>
          <p className="banner-keys">
            <span><b>&larr; &rarr;</b> / <b>A D</b> MOVE</span>
            <span><b>SPACE</b> / <b>W</b> / <b>&uarr;</b> JUMP &mdash; hold to leap higher</span>
            <span><b>STOMP</b> from above to pop the Scourge</span>
            <span><b>R</b> RESTART</span>
          </p>
          <Button id="start-btn" variant="primary" size="lg">
            BREACH THE HULK
          </Button>
        </MenuPanel>
      </MenuScreen>

      <div id="toast" className="toast" />
    </>
  );
}
