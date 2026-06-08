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
import menuHero from "@shipshitgames/assets/games/rothulk/ui/menu/title.webp";

export function AppShell() {
  return (
    <>
      <canvas id="scene" />

      <div id="hud" aria-hidden="true">
        <div className="hud-top">
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Lives</span>
            <span className="hud-value ssg-stat-value" id="hud-lives">
              x3
            </span>
          </div>
          <div className="hud-block ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Integrity</span>
            <div className="hp-bar">
              <div className="hp-fill" id="hud-hp" />
            </div>
          </div>
          <div className="hud-block hud-grow ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Objective</span>
            <span className="hud-value hud-obj" id="hud-obj">
              REACH + IGNITE THE CORE
            </span>
          </div>
          <div className="hud-block hud-right ssg-hud-corner">
            <span className="hud-label ssg-stat-label">Hulk Depth</span>
            <div className="progress">
              <div className="progress-fill" id="hud-progress" />
            </div>
          </div>
        </div>

        <div className="hud-bottom">
          <span className="hud-faction">{"THE PYRE // INFILTRATION"}</span>
          <span className="hud-embers">
            EMBERS <b id="hud-embers">0</b>
          </span>
        </div>
      </div>

      <MainMenuScreen id="banner" className="banner" backgroundImage={menuHero}>
        <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
          Pyre infiltration
        </MainMenuTopBar>
        <MainMenuLayout>
          <MainMenuCopy>
            <MenuKicker>Pyre Infiltration</MenuKicker>
            <MainMenuTitle className="banner-title">
              <MainMenuTitleLine>ROT</MainMenuTitleLine>
              <MainMenuTitleLine tone="hot">HULK</MainMenuTitleLine>
            </MainMenuTitle>
            <MenuKicker className="banner-sub">
              Climb the living Scourge hulk. Ignite the breach-core. Escape the severed node.
            </MenuKicker>
            <MainMenuStatus>
              <span>Boarding spike armed</span>
              <span>Core at crown</span>
            </MainMenuStatus>
          </MainMenuCopy>
          <MainMenuNav aria-label="Main menu">
            <MainMenuAction id="start-btn" variant="primary" label="Breach the Hulk" meta="Begin run" />
            <MainMenuAction variant="shop" label="Upgrades" meta="Core locked" disabled />
            <MainMenuAction variant="coop" label="Co-op" meta="Solo breach" disabled />
            <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
            <MainMenuAction variant="settings" label="Settings" meta="Controls" disabled />
            <MainMenuAction variant="dev" label="Sandbox" meta="Hulk lab" disabled />
          </MainMenuNav>
        </MainMenuLayout>
      </MainMenuScreen>

      <div id="toast" className="toast" />
    </>
  );
}
