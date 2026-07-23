import menuHero from "@shipshitgames/assets/games/starblight/ui/menu/title.webp";
import {
  GameJumpMenu,
  type GameMenuConfig,
  GameMenuTitle,
  GamePauseMenu,
  GlobalMusicToggle,
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
  useEnterToReveal,
} from "@shipshitgames/ui";
import type { MenuSnapshot } from "./menuState";

const GAME_SLUG = "starblight";

interface TitleScreenProps {
  menu: GameMenuConfig;
  open: boolean;
  wreckage: number;
  onEngage: () => void;
  onDrydock: () => void;
  onCodex: () => void;
  onSettings: () => void;
  onWarline: () => void;
}

export function TitleScreen({
  menu,
  open,
  wreckage,
  onEngage,
  onDrydock,
  onCodex,
  onSettings,
  onWarline,
}: TitleScreenProps) {
  const revealed = useEnterToReveal(open);
  const onSplash = open && !revealed;

  return (
    <MainMenuScreen id="banner" className={`banner${open ? "" : " hidden"}`} backgroundImage={menuHero}>
      <MainMenuTopBar mark="SSG" meta={`${wreckage.toLocaleString()} banked`} aria-hidden>
        {menu.topBar}
      </MainMenuTopBar>
      <MainMenuLayout className="ssg-main-menu-layout--menu">
        <MainMenuCopy hidden={revealed}>
          <MenuKicker>{menu.titleKicker}</MenuKicker>
          <GameMenuTitle config={menu} id="banner-title" />
          <p className="ssg-main-menu-subtitle">{menu.titleSubtitle}</p>
          <p className="ssg-main-menu-subtitle">
            MOVE WITH THE MOUSE - weapons auto-fire - collect gems, draft upgrades, stack combos
          </p>
          <MainMenuStatus>
            {menu.titleStatus.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </MainMenuStatus>
        </MainMenuCopy>
        <MainMenuNav aria-label="Main menu" hidden={onSplash}>
          <MainMenuAction id="banner-btn" variant="primary" label="Engage" meta="Start sortie" onClick={onEngage} />
          <MainMenuAction variant="shop" label="Upgrades" meta="Drydock" onClick={onDrydock} />
          <MainMenuAction variant="coop" label="Co-op" meta="Solo sortie" disabled />
          <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
          <MainMenuAction label="Codex" meta="War dossiers" onClick={onCodex} />
          <MainMenuAction variant="settings" label="Settings" meta="Effects" onClick={onSettings} />
          <MainMenuAction variant="dev" label="Sandbox" meta="Orbit lab" disabled />
          <MainMenuAction label={menu.backToWarlineLabel} meta={menu.backToWarlineMeta} onClick={onWarline} />
          <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} />
        </MainMenuNav>
        {onSplash && (
          <>
            <MainMenuEnterPrompt />
            <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} className="ssg-game-jump--splash" />
          </>
        )}
      </MainMenuLayout>
      <GlobalMusicToggle className="ssg-music-toggle--corner" />
    </MainMenuScreen>
  );
}

interface PauseScreenProps {
  snapshot: MenuSnapshot;
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onTitle: () => void;
}

export function PauseScreen({ snapshot, open, onResume, onRestart, onSettings, onTitle }: PauseScreenProps) {
  return (
    <GamePauseMenu
      slug={GAME_SLUG}
      open={open}
      status={
        <span>
          {formatTime(snapshot.timeSec)} - LVL {snapshot.level} - {snapshot.kills} kills
        </span>
      }
      onResume={onResume}
      actions={[
        { id: "restart", label: "Restart run", meta: "New sortie", onSelect: onRestart },
        { id: "settings", label: "Settings", meta: "Audio and effects", onSelect: onSettings },
        { id: "title", label: "Main menu", meta: "Abandon run", onSelect: onTitle },
      ]}
    />
  );
}

interface RunSummaryScreenProps {
  snapshot: MenuSnapshot;
  open: boolean;
  onRestart: () => void;
  onMeta: () => void;
  onTitle: () => void;
}

export function RunSummaryScreen({ snapshot, open, onRestart, onMeta, onTitle }: RunSummaryScreenProps) {
  if (!open || (snapshot.phase !== "gameover" && snapshot.phase !== "victory")) return null;

  const victory = snapshot.phase === "victory";
  return (
    <MainMenuScreen
      className="starblight-run-summary"
      backgroundImage={menuHero}
      role="region"
      aria-label="Run summary"
    >
      <MainMenuTopBar mark="SSG" meta={victory ? "Front held" : "Signal lost"}>
        Sortie report
      </MainMenuTopBar>
      <MainMenuLayout className="ssg-main-menu-layout--menu">
        <MainMenuCopy>
          <MenuKicker>{victory ? "Breach contained" : "Hull integrity lost"}</MenuKicker>
          <MainMenuTitle>
            <MainMenuTitleLine tone={victory ? "ember" : "hot"}>{victory ? "FRONT HELD" : "OVERRUN"}</MainMenuTitleLine>
          </MainMenuTitle>
          <div className="starblight-summary-grid" data-testid="run-summary-stats">
            <SummaryStat label="Time" value={formatTime(snapshot.timeSec)} />
            <SummaryStat label="Level" value={snapshot.level.toLocaleString()} />
            <SummaryStat label="Kills" value={snapshot.kills.toLocaleString()} />
            <SummaryStat label="Salvage" value={`${snapshot.salvage.toLocaleString()} ◆`} />
          </div>
          <div className="starblight-summary-build" data-testid="run-summary-build">
            <span className="starblight-summary-label">Final build</span>
            <div className="starblight-summary-chips">
              {snapshot.build.length > 0 ? (
                snapshot.build.map((chip) => (
                  <span key={chip.id} className={`chip ${chip.kind}${chip.level >= chip.max ? " maxed" : ""}`}>
                    <span className="chip-icon" aria-hidden="true">
                      {chip.icon}
                    </span>
                    <span>{chip.name}</span>
                    <span className="chip-lv">LV {chip.level}</span>
                  </span>
                ))
              ) : (
                <span className="starblight-summary-empty">Unmodified chassis</span>
              )}
            </div>
          </div>
        </MainMenuCopy>
        <MainMenuNav label="After action">
          <MainMenuAction
            variant="primary"
            label={victory ? "Fly again" : "Retry"}
            meta="New sortie"
            onClick={onRestart}
          />
          <MainMenuAction variant="shop" label="Orbital command" meta="Meta progression" onClick={onMeta} />
          <MainMenuAction variant="back" label="Main menu" meta="Return to title" onClick={onTitle} />
        </MainMenuNav>
      </MainMenuLayout>
    </MainMenuScreen>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="starblight-summary-stat">
      <span className="starblight-summary-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface MetaScreenProps {
  open: boolean;
  wreckage: number;
  onDrydock: () => void;
  onCodex: () => void;
  onBack: () => void;
  onTitle: () => void;
}

export function MetaScreen({ open, wreckage, onDrydock, onCodex, onBack, onTitle }: MetaScreenProps) {
  if (!open) return null;

  return (
    <MainMenuScreen
      className="starblight-meta-screen"
      backgroundImage={menuHero}
      role="region"
      aria-label="Orbital command"
    >
      <MainMenuTopBar mark="SSG" meta={`${wreckage.toLocaleString()} wreckage`}>
        Orbital command
      </MainMenuTopBar>
      <MainMenuLayout className="ssg-main-menu-layout--menu">
        <MainMenuCopy>
          <MenuKicker>Between sorties</MenuKicker>
          <MainMenuTitle>
            <MainMenuTitleLine>ORBITAL</MainMenuTitleLine>
            <MainMenuTitleLine tone="hot">COMMAND</MainMenuTitleLine>
          </MainMenuTitle>
          <p className="ssg-main-menu-subtitle">
            Refit the hull, inspect war dossiers, then redeploy against the Starblight breach.
          </p>
          <MainMenuStatus>
            <span>{wreckage.toLocaleString()} wreckage banked</span>
            <span>Refits persist between sorties</span>
          </MainMenuStatus>
        </MainMenuCopy>
        <MainMenuNav label="Orbital command">
          <MainMenuAction variant="shop" label="Drydock" meta="Permanent refits" onClick={onDrydock} />
          <MainMenuAction label="Codex" meta="War dossiers" onClick={onCodex} />
          <MainMenuAction variant="back" label="Run summary" meta="After-action report" onClick={onBack} />
          <MainMenuAction label="Main menu" meta="Return to title" onClick={onTitle} />
        </MainMenuNav>
      </MainMenuLayout>
    </MainMenuScreen>
  );
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
