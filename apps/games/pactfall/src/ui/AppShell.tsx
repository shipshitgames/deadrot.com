import menuHero from "@shipshitgames/assets/games/pactfall/ui/menu/title.webp";
import {
  GameSettingsScreen,
  GlobalMusicToggle,
  goToWarlineLobby,
  MainMenuAction,
  MainMenuCopy,
  MainMenuEnterPrompt,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTitle,
  MainMenuTitleLine,
  MainMenuTopBar,
  MenuKicker,
  PauseMenu,
  useEnterToReveal,
} from "@shipshitgames/ui";
import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import type { Game } from "../game/Game";
import type { Phase } from "../game/types";
import { getBridgeGame, subscribeBridgeGame } from "./gameBridge";

interface OverlayState {
  paused: boolean;
  showSettings: boolean;
}

type OverlayAction =
  | { type: "set"; patch: Partial<OverlayState> }
  | { type: "toggle-pause"; onPause: () => void; onResume: () => void };

function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "toggle-pause": {
      const paused = !state.paused;
      if (paused) action.onPause();
      else action.onResume();
      return { ...state, paused };
    }
  }
}

export function AppShell() {
  // The vanilla Game owns the loop + HUD DOM; it registers itself on the bridge
  // once main.ts has spun it up. We only need it to drive pause/resume.
  const [game, setGame] = useState<Game | null>(() => getBridgeGame());
  const [overlay, dispatchOverlay] = useReducer(overlayReducer, { paused: false, showSettings: false });
  const { paused, showSettings } = overlay;
  const subscribePhase = useCallback(
    (notify: () => void) => {
      if (!game) return () => {};
      return game.subscribePhaseChange((next) => {
        if (next !== "playing") {
          dispatchOverlay({ type: "set", patch: { paused: false, showSettings: false } });
        }
        notify();
      });
    },
    [game],
  );
  const readPhase = useCallback((): Phase => game?.phase ?? "title", [game]);
  const phase = useSyncExternalStore(subscribePhase, readPhase, () => "title");

  // Splash gate: the title nav only appears once the player presses Enter/Space/clicks.
  // Re-arms each time the match returns to the title phase.
  const revealed = useEnterToReveal(phase === "title");

  useEffect(() => subscribeBridgeGame(setGame), []);

  // Esc toggles pause, but only while a match is actually in play.
  useEffect(() => {
    if (!game) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (game.phase !== "playing") return;
      event.preventDefault();
      // Esc closes the settings panel first (back to the pause menu), only then toggles pause.
      if (showSettings) {
        dispatchOverlay({ type: "set", patch: { showSettings: false } });
        return;
      }
      dispatchOverlay({
        type: "toggle-pause",
        onPause: () => game.pause(),
        onResume: () => game.resume(),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, showSettings]);

  const resume = useCallback(() => {
    game?.resume();
    dispatchOverlay({ type: "set", patch: { paused: false, showSettings: false } });
  }, [game]);

  const restart = useCallback(() => {
    dispatchOverlay({ type: "set", patch: { paused: false, showSettings: false } });
    game?.beginRun();
  }, [game]);

  const pauseStatus = useMemo(
    () => (
      <>
        <span>Champion armed</span>
        <span>Scourge prowling</span>
      </>
    ),
    [],
  );

  const pauseActions = useMemo(
    () => [
      { id: "restart", label: "Redeploy", meta: "Restart duel", onSelect: restart },
      {
        id: "settings",
        label: "Settings",
        meta: "Audio",
        variant: "settings" as const,
        onSelect: () => dispatchOverlay({ type: "set", patch: { showSettings: true } }),
      },
    ],
    [restart],
  );

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
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
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
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
                <MainMenuAction
                  type="button"
                  id="title-start-btn"
                  variant="primary"
                  label="Enter arena"
                  meta="Begin duel"
                  onClick={() => game?.beginRun()}
                />
                <MainMenuAction variant="shop" label="Upgrades" meta="Champion locked" disabled />
                <MainMenuAction variant="coop" label="Co-op" meta="Local duel" disabled />
                <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
                <MainMenuAction
                  type="button"
                  variant="settings"
                  label="Settings"
                  meta="Audio"
                  onClick={() => dispatchOverlay({ type: "set", patch: { showSettings: true } })}
                />
                <MainMenuAction variant="dev" label="Sandbox" meta="Arena lab" disabled />
                <MainMenuAction
                  type="button"
                  variant="default"
                  label="← Back to Warline"
                  meta="Lobby"
                  onClick={() => goToWarlineLobby()}
                />
              </MainMenuNav>
            ) : (
              <MainMenuEnterPrompt />
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
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

      {showSettings && (
        <GameSettingsScreen
          open
          onClose={() => dispatchOverlay({ type: "set", patch: { showSettings: false } })}
          kicker="Arena Settings"
          backgroundImage={menuHero}
        />
      )}

      <PauseMenu
        open={paused && phase === "playing" && !showSettings}
        kicker="Ashgate Arena"
        title="Paused"
        subtitle="The duel holds. Catch your breath, then redeploy."
        status={pauseStatus}
        onResume={resume}
        actions={pauseActions}
      />
    </>
  );
}
