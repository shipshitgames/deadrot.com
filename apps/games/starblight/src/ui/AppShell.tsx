import { codexEntriesForGame } from "@deadrot/game-kit";
import menuHero from "@shipshitgames/assets/games/starblight/ui/menu/title.webp";
import { CodexScreen, GameAudioSettingsScreen, gameMenuConfig, goToWarlineLobby, MenuPanel } from "@shipshitgames/ui";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { applyBuy, loadDrydock, type ShopId, saveDrydock } from "../game/drydock";
import { DrydockScreen } from "./DrydockScreen";
import { getMenuSnapshot, getPauseActions, pushDrydockTiers, setRunEndHandler, subscribeMenu } from "./gameBridge";
import { MetaScreen, PauseScreen, RunSummaryScreen, TitleScreen } from "./MenuScreens";

const GAME_SLUG = "starblight";
const menu = gameMenuConfig(GAME_SLUG);
type SecondaryScreen = "settings" | "codex" | "drydock" | "meta";

export function AppShell() {
  const menuState = useSyncExternalStore(subscribeMenu, getMenuSnapshot, getMenuSnapshot);
  const [secondary, setSecondary] = useState<{
    phase: typeof menuState.phase;
    screen: SecondaryScreen | null;
    returnTo: SecondaryScreen | null;
  }>({ phase: menuState.phase, screen: null, returnTo: null });
  if (secondary.phase !== menuState.phase) {
    setSecondary({ phase: menuState.phase, screen: null, returnTo: null });
  }
  const secondaryScreen = secondary.phase === menuState.phase ? secondary.screen : null;
  // No discovery wiring in starblight: every dossier ships unlocked.
  const codexEntries = useMemo(() => codexEntriesForGame("starblight"), []);
  const [drydock, setDrydock] = useState(() => loadDrydock());
  // The run-end banking handler registers once; read live tiers through a ref so
  // the Salvage Tithe multiplier reflects purchases made after mount.
  const drydockRef = useRef(drydock);
  drydockRef.current = drydock;
  useEffect(() => {
    pushDrydockTiers(drydockRef.current.tiers);
    setRunEndHandler((salvage) => {
      const tithe = drydockRef.current.tiers.tithe ?? 0;
      const earned = Math.round(salvage * (1 + 0.12 * tithe));
      if (earned <= 0) return;
      setDrydock((prev) => {
        const next = { ...prev, wreckage: prev.wreckage + earned };
        saveDrydock(next);
        return next;
      });
    });
  }, []);
  const handleBuy = useCallback((id: ShopId) => {
    setDrydock((prev) => {
      const next = applyBuy(prev, id);
      if (next === prev) return prev;
      saveDrydock(next);
      pushDrydockTiers(next.tiers);
      return next;
    });
  }, []);
  const onTitle = menuState.phase === "title";
  const runEnded = menuState.phase === "gameover" || menuState.phase === "victory";
  const closeSecondaryScreens = useCallback(() => {
    setSecondary({ phase: menuState.phase, screen: null, returnTo: null });
  }, [menuState.phase]);
  const closeSecondaryScreen = useCallback(() => {
    setSecondary((current) => ({
      phase: menuState.phase,
      screen: current.phase === menuState.phase ? current.returnTo : null,
      returnTo: null,
    }));
  }, [menuState.phase]);
  const openSecondaryScreen = useCallback(
    (screen: SecondaryScreen, returnTo: SecondaryScreen | null = null) =>
      setSecondary({ phase: menuState.phase, screen, returnTo }),
    [menuState.phase],
  );
  const handleRestart = useCallback(() => {
    closeSecondaryScreens();
    getPauseActions().restart();
  }, [closeSecondaryScreens]);
  const handleTitle = useCallback(() => {
    closeSecondaryScreens();
    getPauseActions().title();
  }, [closeSecondaryScreens]);

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

        <TitleScreen
          menu={menu}
          open={onTitle}
          wreckage={drydock.wreckage}
          onEngage={handleRestart}
          onDrydock={() => openSecondaryScreen("drydock")}
          onCodex={() => openSecondaryScreen("codex")}
          onSettings={() => openSecondaryScreen("settings")}
          onWarline={() => goToWarlineLobby()}
        />

        <RunSummaryScreen
          snapshot={menuState}
          open={runEnded && secondaryScreen === null}
          onRestart={handleRestart}
          onMeta={() => openSecondaryScreen("meta")}
          onTitle={handleTitle}
        />

        <MetaScreen
          open={runEnded && secondaryScreen === "meta"}
          wreckage={drydock.wreckage}
          onDrydock={() => openSecondaryScreen("drydock", "meta")}
          onCodex={() => openSecondaryScreen("codex", "meta")}
          onBack={closeSecondaryScreens}
          onTitle={handleTitle}
        />

        <PauseScreen
          snapshot={menuState}
          open={menuState.phase === "paused" && secondaryScreen !== "settings"}
          onResume={() => getPauseActions().resume()}
          onRestart={handleRestart}
          onSettings={() => openSecondaryScreen("settings")}
          onTitle={handleTitle}
        />

        {secondaryScreen === "settings" && (onTitle || menuState.phase === "paused") && (
          <GameAudioSettingsScreen
            open
            slug={GAME_SLUG}
            onClose={closeSecondaryScreen}
            backgroundImage={menuHero}
            sliderKeys={["music", "sound", "particles", "flash", "shake"]}
          />
        )}
        {secondaryScreen === "codex" && (onTitle || runEnded) && (
          <CodexScreen
            open
            onClose={closeSecondaryScreen}
            kicker={menu.codexKicker}
            backgroundImage={menuHero}
            entries={codexEntries}
          />
        )}
        {secondaryScreen === "drydock" && (onTitle || runEnded) && (
          <DrydockScreen
            open
            onClose={closeSecondaryScreen}
            backgroundImage={menuHero}
            state={drydock}
            onBuy={handleBuy}
          />
        )}

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
