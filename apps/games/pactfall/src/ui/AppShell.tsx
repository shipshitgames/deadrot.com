import { MenuKicker, MenuPanel, MenuScreen } from "@shipshitgames/ui";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />
      <div id="hud">
        <div id="arena-name" />
        <div id="hud-top">
          <div className="meter" id="meter-base-friendly">
            <span className="meter-label">PYRE BASE</span>
            <div className="bar"><i /></div>
          </div>
          <div className="meter" id="meter-base-enemy">
            <span className="meter-label">WARDEN BASE</span>
            <div className="bar bar--enemy"><i /></div>
          </div>
        </div>

        <div id="hud-bottom">
          <div className="meter meter--wide" id="meter-hp">
            <span className="meter-label">CHAMPION HP</span>
            <div className="bar bar--hp"><i /></div>
          </div>
          <div id="buff" className="buff buff--off">
            <span className="buff-label">SCOURGE BUFF</span>
            <span className="buff-time">-</span>
          </div>
        </div>

        <div id="hint">WASD / TAP TO MOVE - AUTO-ATTACKS NEAREST - KILL THE SCOURGE FOR A BUFF</div>

        <MenuScreen id="banner" className="banner banner--hidden">
          <MenuPanel>
            <div className="banner-title ssg-menu-title" />
            <MenuKicker className="banner-sub">PRESS R OR CLICK TO REDEPLOY</MenuKicker>
          </MenuPanel>
        </MenuScreen>
      </div>
    </>
  );
}
