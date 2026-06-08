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
import menuHero from "@shipshitgames/assets/games/pactfall/ui/menu/title.webp";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />
      <div id="hud">
        <div id="arena-name" />
        <div id="hud-top">
          <div className="meter" id="meter-base-friendly">
            <span className="meter-label">PYRE BASE</span>
            <div className="bar">
              <i />
            </div>
          </div>
          <div className="meter" id="meter-base-enemy">
            <span className="meter-label">WARDEN BASE</span>
            <div className="bar bar--enemy">
              <i />
            </div>
          </div>
        </div>

        <div id="hud-bottom">
          <div className="meter meter--wide" id="meter-hp">
            <span className="meter-label">CHAMPION HP</span>
            <div className="bar bar--hp">
              <i />
            </div>
          </div>
          <div id="buff" className="buff buff--off">
            <span className="buff-label">SCOURGE BUFF</span>
            <span className="buff-time">-</span>
          </div>
        </div>

        <div id="hint">WASD / TAP TO MOVE - AUTO-ATTACKS NEAREST - KILL THE SCOURGE FOR A BUFF</div>

        <MainMenuScreen id="title-screen" className="banner" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
            Broken concord
          </MainMenuTopBar>
          <MainMenuLayout>
            <MainMenuCopy>
              <MenuKicker>Pyre vs Warden Arena</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine>PACT</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">FALL</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle">
                Break the Warden base before the Scourge turns the duel into a feeding ground.
              </p>
              <MainMenuStatus>
                <span>Champion armed</span>
                <span>Neutral Scourge buff</span>
              </MainMenuStatus>
            </MainMenuCopy>
            <MainMenuNav aria-label="Main menu">
              <MainMenuAction id="title-start-btn" variant="primary" label="Enter arena" meta="Begin duel" />
              <MainMenuAction variant="shop" label="Upgrades" meta="Champion locked" disabled />
              <MainMenuAction variant="coop" label="Co-op" meta="Local duel" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction variant="settings" label="Settings" meta="Auto attack" disabled />
              <MainMenuAction variant="dev" label="Sandbox" meta="Arena lab" disabled />
            </MainMenuNav>
          </MainMenuLayout>
        </MainMenuScreen>

        <MainMenuScreen id="banner" className="banner banner--hidden" backgroundImage={menuHero}>
          <MainMenuLayout>
            <MainMenuCopy>
              <MainMenuTitle className="banner-title" />
              <MenuKicker className="banner-sub">PRESS R OR CLICK TO REDEPLOY</MenuKicker>
            </MainMenuCopy>
          </MainMenuLayout>
        </MainMenuScreen>
      </div>
    </>
  );
}
