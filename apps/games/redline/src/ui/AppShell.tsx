import { Button, MenuKicker, MenuPanel, MenuScreen, MenuTitle } from "@shipshitgames/ui";

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
          <div className="hud-value"><span id="hud-speed">0</span><span className="hud-unit">u/s</span></div>
        </div>

        <div className="hud-corner hud-tr ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Time</div>
          <div className="hud-value mono"><span id="hud-time">0.00</span></div>
          <div className="hud-sub ssg-stat-sub">Best <span id="hud-best" className="mono">--.--</span></div>
        </div>

        <div className="hud-corner hud-bl ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Distance</div>
          <div className="hud-value mono"><span id="hud-dist">0</span><span className="hud-unit">m</span></div>
        </div>

        <div className="hud-corner hud-br ssg-hud-corner">
          <div className="hud-label ssg-stat-label">Lane</div>
          <div className="hud-value" id="hud-status">RUN</div>
        </div>

        <div id="progress">
          <div id="progress-fill" />
          <div id="progress-beacon">{"\u26eb"}</div>
        </div>
      </div>

      <MenuScreen id="overlay">
        <MenuPanel id="overlay-card">
          <MenuKicker id="overlay-kicker">Pyre Courier Run</MenuKicker>
          <MenuTitle id="overlay-title">REDLINE</MenuTitle>
          <p id="overlay-body">
            Carry the cargo through the Scourge-rot lane to the BEACON. Beat the clock.
          </p>
          <ul id="overlay-controls">
            <li><kbd>HOLD -&gt;</kbd> / <kbd>D</kbd> Accelerate</li>
            <li><kbd>SPACE</kbd> / <kbd>UP</kbd> / <kbd>W</kbd> Jump</li>
            <li><kbd>SHIFT</kbd> / <kbd>DOWN</kbd> / <kbd>S</kbd> Dash-roll</li>
            <li><kbd>R</kbd> Restart</li>
          </ul>
          <Button id="overlay-btn" variant="primary" size="lg">
            IGNITE
          </Button>
        </MenuPanel>
      </MenuScreen>
    </>
  );
}
