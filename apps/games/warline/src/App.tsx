import menuHero from "@shipshitgames/assets/games/warline/ui/menu/title.webp";
import {
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
import { useState } from "react";
import { CommandPanel } from "./components/CommandPanel";
import { FrontMap3D } from "./components/FrontMap3D";
import { Header } from "./components/Header";
import { Legend } from "./components/Legend";
import { OpsPanel } from "./components/OpsPanel";
import { ResourceBar } from "./components/ResourceBar";
import { WarFeed } from "./components/WarFeed";
import { WarMap } from "./components/WarMap";
import { useWarline } from "./store";

export default function App() {
  const { state, summary, status, faction, setFaction, command, simulate } = useWarline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState(true);
  // The Front is the walkable 3D lobby (portals to every game); the Command
  // Table swaps in the Warline strategy UI. Title menu enters the Front.
  const [mode, setMode] = useState<"front" | "command">("front");
  const revealed = useEnterToReveal(showTitle);

  return (
    <div className="relative min-h-screen bg-void text-ash">
      {showTitle && (
        <MainMenuScreen
          className="warline-title-screen"
          backgroundImage={menuHero}
          style={{ position: "fixed", zIndex: 60 }}
        >
          <MainMenuTopBar mark="SSG" meta={status === "LIVE" ? "Live front" : "Local front"} aria-hidden>
            War for the lanes
          </MainMenuTopBar>
          <MainMenuLayout className={revealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
            <MainMenuCopy hidden={revealed}>
              <MenuKicker>Strategic Command</MenuKicker>
              <MainMenuTitle>
                <MainMenuTitleLine>WAR</MainMenuTitleLine>
                <MainMenuTitleLine tone="hot">LINE</MainMenuTitleLine>
              </MainMenuTitle>
              <p className="ssg-main-menu-subtitle">
                Walk the Front, step through a portal into any game, or take the Command Table to push the war.
              </p>
              <MainMenuStatus>
                <span>{status === "LIVE" ? "Shared front online" : "Standalone simulation"}</span>
                <span>Threat {Math.round(summary.threat)}%</span>
              </MainMenuStatus>
            </MainMenuCopy>
            {revealed ? (
              <MainMenuNav aria-label="Main menu">
                <MainMenuAction
                  type="button"
                  variant="primary"
                  label="Enter the Front"
                  meta="3D lobby"
                  onClick={() => {
                    setMode("front");
                    setShowTitle(false);
                  }}
                />
                <MainMenuAction
                  type="button"
                  variant="shop"
                  label="Command Table"
                  meta="War map"
                  onClick={() => {
                    setMode("command");
                    setShowTitle(false);
                  }}
                />
                <MainMenuAction
                  variant="coop"
                  label="Co-op"
                  meta={status === "LIVE" ? "Shared room" : "Offline"}
                  disabled
                />
                <MainMenuAction variant="records" label="Leaderboard" meta="No records" disabled />
                <MainMenuAction variant="settings" label="Settings" meta="Simulation" disabled />
                <MainMenuAction variant="dev" label="Sandbox" meta="Ops sim" disabled />
              </MainMenuNav>
            ) : (
              <MainMenuEnterPrompt />
            )}
          </MainMenuLayout>
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>
      )}

      <Header state={state} summary={summary} status={status} />

      {!showTitle &&
        (mode === "front" ? (
          <FrontMap3D
            state={state}
            summary={summary}
            status={status}
            faction={faction}
            onOpenCommand={() => setMode("command")}
            onExitToTitle={() => setShowTitle(true)}
          />
        ) : (
          <main className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-gunmetal bg-coal px-3 py-2">
              <div>
                <div className="font-display text-xs tracking-wide text-hellfire">Command Table</div>
                <div className="font-mono text-[0.7rem] text-ash">
                  EPOCH {state.epoch} / TICK {state.tick}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode("front")}
                className="border-2 border-hellfire bg-iron px-3 py-2 font-display text-xs tracking-wide text-bone transition-colors hover:bg-hellfire/20"
              >
                Return to Front
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Map — large, spans two columns on lg */}
              <div className="lg:col-span-2">
                <WarMap state={state} selectedId={selectedId} onSelect={setSelectedId} />
              </div>

              {/* Right rail */}
              <div className="flex flex-col gap-4">
                <ResourceBar resources={state.resources} army={state.pactArmy} />
                <CommandPanel
                  state={state}
                  faction={faction}
                  setFaction={setFaction}
                  selectedId={selectedId}
                  command={command}
                />
                <OpsPanel simulate={simulate} />
                <Legend />
              </div>
            </div>

            {/* Feed below, full width */}
            <div className="mt-4 h-80">
              <WarFeed feed={state.feed} />
            </div>
          </main>
        ))}

      <footer className="border-t-2 border-gunmetal px-4 py-3 text-center sm:px-6">
        <p className="font-mono text-[0.65rem] text-ash">
          WARLINE · War for the Lanes ·{" "}
          {status === "LOCAL"
            ? "standalone simulation (no server)"
            : status === "LIVE"
              ? "live shared front"
              : "connecting to the front…"}
        </p>
      </footer>
    </div>
  );
}
