import { Button, MenuKicker, MenuPanel, MenuScreen, MenuTitle } from "@shipshitgames/ui";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />

      <div id="hud">
        <div className="hud-top">
          <div className="level-badge">LVL <span id="level" className="mono">1</span></div>
          <div className="xpbar"><div id="xp-fill" /></div>
          <div className="top-right">
            <span id="salvage" className="mono">0</span>
            <span className="salvage-icon">{"\u25c6"}</span>
            <span id="kills" className="kills">0 kills</span>
          </div>
        </div>
        <div id="timer" className="mono">0:00</div>
        <div id="boss-bar" className="hidden">
          <span className="boss-name">THE BLIGHT-MAW</span>
          <div className="boss-track"><div id="boss-fill" /></div>
        </div>

        <div className="hud-bottomleft">
          <div className="intbar">
            <span className="label">Integrity</span>
            <div className="int-track"><div id="int-fill" /></div>
            <span id="int-text" className="mono">100/100</span>
          </div>
          <div id="build-tray" />
        </div>

        <MenuScreen id="banner" className="banner">
          <MenuPanel className="banner-inner">
            <MenuTitle id="banner-title">STARBLIGHT</MenuTitle>
            <MenuKicker id="banner-sub">THE ORBITAL FRONT</MenuKicker>
            <p className="hint" id="banner-hint">
              MOVE WITH THE MOUSE - weapons auto-fire - collect gems, draft upgrades, stack combos
            </p>
            <Button id="banner-btn" className="cta" variant="primary" size="lg">
              ENGAGE
            </Button>
          </MenuPanel>
        </MenuScreen>

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
