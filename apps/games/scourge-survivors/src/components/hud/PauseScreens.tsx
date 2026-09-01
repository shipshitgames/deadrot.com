import { Button, GameAudioSettingsScreen, GamePauseMenu, type PauseMenuAction } from "@shipshitgames/ui";
import { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { MENU_HERO_URL } from "../../assets/menuArt";
import { MELEE_WEAPON_NAME } from "../../game/constants";
import { SCOURGE_THREAT_TIERS } from "../../game/data/enemies";
import type { HudState } from "../../game/types";
import { IconText, OVERLAY } from "./shared";

const GAME_SLUG = "scourge-survivors";

/** Pause menu + its settings/controls sub-panels. */
export function PauseScreens({
  state,
  suppressMenu,
  onEscapeResume,
  onRestart,
  onLeaveRoom,
  onMenu,
}: {
  state: HudState;
  suppressMenu: boolean;
  onEscapeResume: () => void;
  onRestart: () => void;
  onLeaveRoom: () => void;
  onMenu: () => void;
}) {
  const { status, multiplayer, room, connected, kills, score, bossActive, wave, totalWaves } = state;

  const [pausePanel, setPausePanel] = useState<"none" | "settings" | "controls">("none");
  const prevStatusRef = useRef(status);
  // Always reopen the pause menu on its root screen.
  if (status !== prevStatusRef.current) {
    prevStatusRef.current = status;
    if (status !== "paused" && pausePanel !== "none") setPausePanel("none");
  }

  const handleEscapeResume = useEffectEvent(() => {
    onEscapeResume();
  });

  useEffect(() => {
    if (status !== "paused" || suppressMenu || pausePanel !== "none") return;
    const resumeOnEscape = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      handleEscapeResume();
    };
    window.addEventListener("keydown", resumeOnEscape, { capture: true });
    return () => window.removeEventListener("keydown", resumeOnEscape, { capture: true });
  }, [pausePanel, status, suppressMenu]);

  // Status row + real actions for the shared PauseMenu (mirrors the title menu;
  // no shop affordance). Multiplayer surfaces arena/connection info + Leave.
  const pauseStatus = useMemo<ReactNode>(
    () =>
      multiplayer ? (
        <>
          <span>
            Arena {room || "-"} · {connected ? "connected" : "connecting…"}
          </span>
          <span>{kills} frags</span>
        </>
      ) : (
        <>
          <span>Score {score.toLocaleString()}</span>
          <span>{bossActive ? SCOURGE_THREAT_TIERS.breachBoss.banner : `Wave ${wave}/${totalWaves}`}</span>
          <span>{kills} kills</span>
        </>
      ),
    [bossActive, connected, kills, multiplayer, room, score, totalWaves, wave],
  );
  const pauseActions: PauseMenuAction[] = [
    {
      id: "settings",
      label: "Settings",
      meta: "Audio",
      variant: "settings",
      onSelect: () => setPausePanel("settings"),
    },
    {
      id: "controls",
      label: "Controls",
      meta: "Key bindings",
      variant: "default",
      onSelect: () => setPausePanel("controls"),
    },
    ...(multiplayer
      ? []
      : [
          {
            id: "restart",
            label: "Restart Run",
            meta: "New breach",
            variant: "default" as const,
            onSelect: onRestart,
          },
        ]),
    ...(multiplayer
      ? [
          {
            id: "leave",
            label: "Leave Arena",
            meta: room || "PvP preview room",
            variant: "default" as const,
            onSelect: onLeaveRoom,
          },
        ]
      : []),
    {
      id: "title",
      label: "Exit to Menu",
      meta: "Main menu",
      onSelect: onMenu,
    },
  ];

  return (
    <>
      {status === "paused" && !suppressMenu && pausePanel === "none" && (
        <GamePauseMenu
          slug={GAME_SLUG}
          open
          className="pause-ui"
          backgroundImage={MENU_HERO_URL}
          kicker={multiplayer ? "PvP arena preview" : "Pyre breach"}
          subtitle={multiplayer ? "No PvE waves. The live arena continues while you regroup." : undefined}
          status={pauseStatus}
          onResume={onEscapeResume}
          actions={pauseActions}
        />
      )}

      {status === "paused" && !suppressMenu && pausePanel === "settings" && (
        <GameAudioSettingsScreen
          open
          slug={GAME_SLUG}
          className="pause-ui"
          onClose={() => setPausePanel("none")}
          backgroundImage={MENU_HERO_URL}
          backMeta="Pause menu"
        />
      )}

      {status === "paused" && !suppressMenu && pausePanel === "controls" && (
        <div className={`${OVERLAY} relative`}>
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent"
            aria-label="Resume run"
            onClick={onEscapeResume}
          />
          <h2 className="relative z-[1] m-0 mb-[18px] text-[30px] font-bold">
            <IconText icon="gamepad" size={26}>
              Controls
            </IconText>
          </h2>
          <div className="pause-ui relative z-[1] flex flex-col gap-[10px] w-[min(340px,86vw)] pointer-events-auto">
            <div className="flex flex-col gap-2 px-[18px] py-[14px] bg-white/[0.04] border border-white/[0.12] rounded-[10px] text-[14px] [&>div]:flex [&>div]:items-center [&>div]:gap-[10px] [&_span]:shrink-0 [&_span]:w-[110px] [&_span]:text-right [&_span]:opacity-85">
              <div>
                <span>
                  <kbd>WASD</kbd>
                </span>{" "}
                Move
              </div>
              <div>
                <span>
                  <kbd>Mouse</kbd>
                </span>{" "}
                Look
              </div>
              <div>
                <span>
                  <kbd>L-Click</kbd>
                </span>{" "}
                Fire
              </div>
              <div>
                <span>
                  <kbd>R-Click</kbd>
                </span>{" "}
                ADS
              </div>
              <div>
                <span>
                  <kbd>Wheel</kbd>
                </span>{" "}
                Weapon switch
              </div>
              <div>
                <span>
                  <kbd>R-Click</kbd> + <kbd>Wheel</kbd>
                </span>{" "}
                Scope zoom
              </div>
              <div>
                <span>
                  <kbd>F</kbd> / <kbd>V</kbd>
                </span>{" "}
                {MELEE_WEAPON_NAME}
              </div>
              <div>
                <span>
                  <kbd>1</kbd>–<kbd>5</kbd>
                </span>{" "}
                Weapon
              </div>
              <div>
                <span>
                  <kbd>Space</kbd>
                </span>{" "}
                Jump
              </div>
              <div>
                <span>
                  <kbd>Shift</kbd>
                </span>{" "}
                Run
              </div>
              <div>
                <span>
                  <kbd>Ctrl</kbd> / <kbd>C</kbd>
                </span>{" "}
                Crouch
              </div>
              <div>
                <span>
                  <kbd>R</kbd>
                </span>{" "}
                Reload
              </div>
              <div>
                <span>
                  <kbd>E</kbd>
                </span>{" "}
                Doors / stairs
              </div>
              <div>
                <span>
                  <kbd>Esc</kbd>
                </span>{" "}
                Pause / Resume
              </div>
            </div>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setPausePanel("none")}>
              ← Back
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
