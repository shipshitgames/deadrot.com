import menuHero from "@shipshitgames/assets/games/pactfall/ui/menu/title.webp";
import {
  GameAudioSettingsScreen,
  GameJumpMenu,
  GameMenuTitle,
  GamePauseMenu,
  GlobalMusicToggle,
  gameMenuConfig,
  goToWarlineLobby,
  MainMenuAction,
  MainMenuCopy,
  MainMenuEnterPrompt,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTitle,
  MainMenuTopBar,
  MenuKicker,
  useEnterToReveal,
} from "@shipshitgames/ui";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Game } from "../game/Game";
import { ABILITY_KEYS, type AbilityKey } from "../game/systems/abilities";
import type { Phase } from "../game/types";
import { getBridgeGame, subscribeBridgeGame } from "./gameBridge";

const GAME_SLUG = "pactfall";
const menu = gameMenuConfig(GAME_SLUG);

export function AppShell() {
  // The vanilla Game owns the loop + HUD DOM; it registers itself on the bridge
  // once main.ts has spun it up. We only need it to drive pause/resume.
  const [game, setGame] = useState<Game | null>(() => getBridgeGame());
  const [showSettings, setShowSettings] = useState(false);
  const subscribePhase = useCallback(
    (notify: () => void) => {
      if (!game) return () => {};
      return game.subscribePhaseChange((next) => {
        if (next !== "playing") setShowSettings(false);
        notify();
      });
    },
    [game],
  );
  const readPhase = useCallback((): Phase => game?.phase ?? "title", [game]);
  const phase = useSyncExternalStore(subscribePhase, readPhase, () => "title");

  // Pause lives on the Game (the single owner); mirror it the same way as phase.
  const subscribePause = useCallback(
    (notify: () => void) => (game ? game.subscribePauseChange(() => notify()) : () => {}),
    [game],
  );
  const readPaused = useCallback((): boolean => game?.paused ?? false, [game]);
  const paused = useSyncExternalStore(subscribePause, readPaused, () => false);

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
        setShowSettings(false);
        return;
      }
      if (game.paused) game.resume();
      else game.pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, showSettings]);

  const resume = useCallback(() => {
    game?.resume();
    setShowSettings(false);
  }, [game]);

  const restart = useCallback(() => {
    setShowSettings(false);
    game?.beginRun();
  }, [game]);

  // Tap-to-cast: HUD ability buttons latch a press through the same queue the
  // keyboard uses, so touch players can cast Q/W/E. pointerdown (not click)
  // keeps it instant, and preventDefault stops the button from taking focus
  // away from the canvas / synthesizing a click-to-move underneath.
  const castAbility = useCallback(
    (key: AbilityKey, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      game?.input.pressAbility(key);
    },
    [game],
  );

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
        onSelect: () => setShowSettings(true),
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
            <span className="meter-label">
              PYRE BASE
              <span className="meter-towers" id="towers-friendly" title="Pyre towers standing" />
            </span>
            <div className="bar">
              <i />
            </div>
          </div>
          <div className="meter" id="meter-base-enemy">
            <span className="meter-label">
              WARDEN BASE
              <span className="meter-towers" id="towers-enemy" title="Warden towers standing" />
            </span>
            <div className="bar bar--enemy">
              <i />
            </div>
          </div>
        </div>

        <div id="hud-abilities">
          {ABILITY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="ability"
              id={`ability-${key}`}
              tabIndex={-1}
              onPointerDown={(event) => castAbility(key, event)}
            >
              <span className="ability-key">{key.toUpperCase()}</span>
              <span className="ability-name" />
              <span className="ability-cd">RDY</span>
            </button>
          ))}
          <div className="mana-block" id="meter-mana">
            <span className="mana-label">
              MANA <span className="mana-value">100</span>
            </span>
            <div className="bar bar--mana">
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

        <div id="hint">CLICK / ARROWS TO MOVE - Q LANCE - W BRAND - E VAULT - SLAY THE SCOURGE FOR A BUFF</div>

        <MainMenuScreen
          id="title-screen"
          className={phase === "title" ? "banner" : "banner banner--hidden"}
          backgroundImage={menuHero}
        >
          <MainMenuTopBar mark="SSG" meta="0 gold" aria-hidden>
            {menu.topBar}
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>{menu.titleKicker}</MenuKicker>
              <GameMenuTitle config={menu} />
              <p className="ssg-main-menu-subtitle">{menu.titleSubtitle}</p>
              <MainMenuStatus>
                {menu.titleStatus.map((item) => (
                  <span key={item}>{item}</span>
                ))}
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
                  onClick={() => setShowSettings(true)}
                />
                <MainMenuAction variant="dev" label="Sandbox" meta="Arena lab" disabled />
                <MainMenuAction
                  type="button"
                  variant="default"
                  label={menu.backToWarlineLabel}
                  meta={menu.backToWarlineMeta}
                  onClick={() => goToWarlineLobby()}
                />
                <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} />
              </MainMenuNav>
            ) : (
              <>
                <MainMenuEnterPrompt />
                <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} className="ssg-game-jump--splash" />
              </>
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>

        {(phase === "won" || phase === "lost") && (
          <MainMenuScreen id="banner" className="banner" backgroundImage={menuHero}>
            <MainMenuLayout>
              <MainMenuCopy>
                <MainMenuTitle className="banner-title">
                  {phase === "won" ? "VICTORY - WARDEN BASE FALLS" : "DEFEAT - THE PYRE IS EXTINGUISHED"}
                </MainMenuTitle>
                <MenuKicker className="banner-sub">PRESS R OR CLICK TO REDEPLOY</MenuKicker>
              </MainMenuCopy>
            </MainMenuLayout>
          </MainMenuScreen>
        )}
      </div>

      {showSettings && (
        <GameAudioSettingsScreen
          open
          slug={GAME_SLUG}
          onClose={() => setShowSettings(false)}
          backgroundImage={menuHero}
        />
      )}

      <GamePauseMenu
        slug={GAME_SLUG}
        open={paused && phase === "playing" && !showSettings}
        status={pauseStatus}
        onResume={resume}
        actions={pauseActions}
      />
    </>
  );
}
