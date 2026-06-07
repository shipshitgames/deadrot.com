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
  MenuKicker,
  MenuPanel,
} from "@shipshitgames/ui";

export function AppShell() {
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

        <MainMenuScreen id="banner" className="banner">
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
            <MainMenuNav label="Launch">
              <MainMenuAction id="banner-btn" variant="primary" label="ENGAGE" meta="Start sortie" />
              <GlobalMusicToggle />
              <GlobalGameSettingsPanel inline />
            </MainMenuNav>
          </MainMenuLayout>
        </MainMenuScreen>

        <div id="pause-menu" className="pause-menu hidden">
          <MenuPanel className="pause-inner">
            <h2 className="pause-title ssg-section-heading">PAUSED</h2>
            <p id="pause-stats" className="pause-stats mono">
              0:00 - LVL 1 - 0 kills
            </p>
            <GlobalGameSettingsPanel inline />
            <div className="pause-actions">
              <button id="pause-resume" className="menu-action primary" type="button">
                RESUME
              </button>
              <button id="pause-restart" className="menu-action" type="button">
                RESTART RUN
              </button>
              <button id="pause-title-btn" className="menu-action ghost" type="button">
                MAIN MENU
              </button>
            </div>
          </MenuPanel>
        </div>

        <div id="pause-menu" className="pause-menu hidden">
          <MenuPanel className="pause-inner">
            <h2 className="pause-title ssg-section-heading">PAUSED</h2>
            <p id="pause-stats" className="pause-stats mono">
              0:00 - LVL 1 - 0 kills
            </p>
            <GlobalGameSettingsPanel inline />
            <div className="pause-actions">
              <button id="pause-resume" className="menu-action primary" type="button">
                RESUME
              </button>
              <button id="pause-restart" className="menu-action" type="button">
                RESTART RUN
              </button>
              <button id="pause-title-btn" className="menu-action ghost" type="button">
                MAIN MENU
              </button>
            </div>
          </MenuPanel>
        </div>

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
