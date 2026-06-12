import { codexEntriesForGame } from "@deadrot/game-kit";
import menuHero from "@shipshitgames/assets/games/starblight/ui/menu/title.webp";
import {
  CodexScreen,
  GameJumpMenu,
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
  MenuPanel,
  PauseMenu,
  useEnterToReveal,
} from "@shipshitgames/ui";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { applyBuy, loadDrydock, type ShopId, saveDrydock } from "../game/drydock";
import { DrydockScreen } from "./DrydockScreen";
import { getPauseActions, getPauseSnapshot, pushDrydockTiers, setRunEndHandler, subscribePause } from "./gameBridge";

export function AppShell() {
  // Pause state lives in the imperative Game engine; mirror it here via the
  // bridge so the shared React PauseMenu can render over the canvas.
  const pause = useSyncExternalStore(subscribePause, getPauseSnapshot, getPauseSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  // No discovery wiring in starblight: every dossier ships unlocked.
  const codexEntries = useMemo(() => codexEntriesForGame("starblight"), []);
  const [drydock, setDrydock] = useState(() => loadDrydock());
  const [drydockOpen, setDrydockOpen] = useState(false);
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
  // The #banner screen is reused for the title, game-over, and victory states
  // (the engine writes #banner-title/#banner-sub for the latter two). Gate the
  // splash/menu behaviour on the title phase so the hero copy hides once the
  // menu is revealed, but stays visible for the engine-written result banners.
  const onTitle = pause.phase === "title";
  const revealed = useEnterToReveal(onTitle);
  const onSplash = onTitle && !revealed;
  const pauseStatus = useMemo(() => <span>{pause.stats}</span>, [pause.stats]);
  const pauseActions = useMemo(
    () => [
      { id: "restart", label: "Restart run", meta: "New sortie", onSelect: () => getPauseActions().restart() },
      { id: "title", label: "Main menu", meta: "Exit to title", onSelect: () => getPauseActions().title() },
    ],
    [],
  );

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

        <MainMenuScreen id="banner" className="banner" backgroundImage={menuHero}>
          <MainMenuTopBar mark="SSG" meta="0 salvage" aria-hidden>
            Orbital front
          </MainMenuTopBar>
          <MainMenuLayout className="ssg-main-menu-layout--menu">
            {/* Hidden once the title menu is revealed, but shown again for the
                engine-written game-over / victory banner (phase leaves "title"). */}
            <MainMenuCopy hidden={onTitle && revealed}>
              <MenuKicker>Orbital Survivors Front</MenuKicker>
              <MainMenuTitle id="banner-title">
                <MainMenuTitleLine>STAR</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">BLIGHT</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle" id="banner-sub">
                THE ORBITAL FRONT
              </p>
              <p className="ssg-main-menu-subtitle" id="banner-hint">
                MOVE WITH THE MOUSE - weapons auto-fire - collect gems, draft upgrades, stack combos
              </p>
              <MainMenuStatus>
                <span>Interceptor online</span>
                <span>Draft systems hot</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {/* Nav stays mounted (engine grabs #banner-btn at boot). Hidden only
                on the title splash; shown for the menu and the engine's game-over
                banner (which un-hides #banner-btn as "Re-engage"). */}
            <MainMenuNav aria-label="Main menu" hidden={onSplash}>
              <MainMenuAction id="banner-btn" variant="primary" label="Engage" meta="Start sortie" />
              <MainMenuAction
                type="button"
                variant="shop"
                label="Upgrades"
                meta="Drydock"
                onClick={() => setDrydockOpen(true)}
              />
              <MainMenuAction variant="coop" label="Co-op" meta="Solo sortie" disabled />
              <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
              <MainMenuAction
                type="button"
                variant="default"
                label="Codex"
                meta="War dossiers"
                onClick={() => setCodexOpen(true)}
              />
              <MainMenuAction
                type="button"
                variant="settings"
                label="Settings"
                meta="Audio"
                onClick={() => setSettingsOpen(true)}
              />
              <MainMenuAction variant="dev" label="Sandbox" meta="Orbit lab" disabled />
              <MainMenuAction
                type="button"
                variant="default"
                label="← Back to Warline"
                meta="Lobby"
                onClick={() => goToWarlineLobby()}
              />
              <GameJumpMenu currentSlug="starblight" />
            </MainMenuNav>
            {onSplash && <MainMenuEnterPrompt />}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>

        <PauseMenu
          open={pause.open}
          kicker="Orbital Front"
          title="Paused"
          subtitle="The Scourge holds at the threshold while you stand down."
          status={pauseStatus}
          onResume={() => getPauseActions().resume()}
          actions={pauseActions}
        />

        {settingsOpen && <GameSettingsScreen open onClose={() => setSettingsOpen(false)} backgroundImage={menuHero} />}
        {codexOpen && (
          <CodexScreen
            open
            onClose={() => setCodexOpen(false)}
            kicker="Orbital Front"
            backgroundImage={menuHero}
            entries={codexEntries}
          />
        )}
        {drydockOpen && (
          <DrydockScreen
            open
            onClose={() => setDrydockOpen(false)}
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
