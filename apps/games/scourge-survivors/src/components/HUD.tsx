import { PixelConfetti, UpgradeCard } from "@shipshitgames/ui";
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useRef } from "react";
import type { SurvivorClassId } from "../game/data/survivors";
import type { ScoreEntry, ShopState } from "../game/storage";
import type { HUDState } from "../game/types";
import type { PlayerAvatarId } from "../net/playerAvatars";
import { CombatOverlays } from "./hud/CombatOverlays";
import { GameOverScreen } from "./hud/GameOverScreen";
import { MainMenu } from "./hud/MainMenu";
import { PauseScreens } from "./hud/PauseScreens";
import { IconText, OVERLAY } from "./hud/shared";
import { PixelIcon } from "./PixelIcon";

interface Props {
  state: HUDState;
  scores: ScoreEntry[];
  onLock: () => void;
  onRestart: () => void;
  onClearScores: () => void;
  onStartMultiplayer: (name: string, room: string, avatar: PlayerAvatarId) => void;
  onLeaveRoom: () => void;
  onStartSurvivors: (classId?: SurvivorClassId) => void;
  onStartSandbox?: () => void;
  onPickUpgrade: (id: string) => void;
  onReroll: () => void;
  onBanish: (id: string) => void;
  onMenu: () => void;
  shop: ShopState;
  lastRunGold: number;
  onBuyShop: (id: string) => void;
  initialRoom: string;
  suppressMenu?: boolean;
}

const DRAFT_PRESS_MAX_AGE_MS = 1200;

function LevelUpDraft({
  state,
  onPick,
  onReroll,
  onBanish,
}: {
  state: HUDState;
  onPick: (id: string) => void;
  onReroll: () => void;
  onBanish: (id: string) => void;
}) {
  const draftPressRef = useRef<{ action: string; at: number } | null>(null);
  const armDraftAction = (action: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    draftPressRef.current = { action, at: window.performance.now() };
  };
  const consumeDraftAction = (action: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      draftPressRef.current = null;
      return true;
    }
    const press = draftPressRef.current;
    draftPressRef.current = null;
    return !!press && press.action === action && window.performance.now() - press.at <= DRAFT_PRESS_MAX_AGE_MS;
  };
  const runDraftAction = (action: string, event: ReactMouseEvent<HTMLButtonElement>, callback: () => void) => {
    // The level-up overlay can appear while the player is still holding fire; require
    // a fresh press that started on this draft button before accepting the click.
    if (!consumeDraftAction(action, event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    callback();
  };

  return (
    <div className={`${OVERLAY} cursor-default`}>
      <PixelConfetti seed={state.level} />
      <div className="relative z-[1] flex flex-col items-center gap-[18px]">
        <div className="ssg-menu-kicker mb-[10px]">Level {state.level} — choose an upgrade</div>
        <h2 className="ssg-menu-title !text-[40px] !mb-5">CHOOSE UPGRADE</h2>
        <div className="flex gap-[18px] flex-wrap justify-center items-stretch max-w-[92vw]">
          {state.choices.map((c) => (
            <div key={c.id} className="relative flex">
              <UpgradeCard
                featured={c.golden}
                icon={<PixelIcon id={c.icon} size={60} label={c.name} />}
                title={c.name}
                meta={c.golden ? "EVO" : c.level === 0 ? "NEW" : `LV ${c.level + 1}`}
                metaTone={c.level === 0 ? "new" : "level"}
                description={c.desc}
                tooltip={c.desc}
                onPointerDown={(event) => armDraftAction(`pick:${c.id}`, event)}
                onClick={(event) => runDraftAction(`pick:${c.id}`, event, () => onPick(c.id))}
              />
              {!c.golden && state.banishes > 0 && (
                <button
                  type="button"
                  title="Banish — remove from this run's pool"
                  onPointerDown={(event) => armDraftAction(`banish:${c.id}`, event)}
                  onClick={(event) => runDraftAction(`banish:${c.id}`, event, () => onBanish(c.id))}
                  className="pointer-events-auto cursor-pointer absolute -top-2 -left-2 w-7 h-7 rounded-full bg-black/70 border border-white/25 text-white/70 text-[14px] leading-none flex items-center justify-center hover:bg-[#c1121f] hover:text-white hover:border-[#c1121f]"
                >
                  <PixelIcon id="banish" size={16} label="Banish" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-6">
          <button
            type="button"
            disabled={state.rerolls <= 0}
            onPointerDown={(event) => armDraftAction("reroll", event)}
            onClick={(event) => runDraftAction("reroll", event, onReroll)}
            className="pointer-events-auto cursor-pointer text-[14px] font-bold rounded-lg px-4 py-2 border border-[#ff6a00]/45 text-[#e9e3d6] transition-colors hover:bg-[#ff6a00]/15 hover:border-[#ff6a00] disabled:opacity-40 disabled:cursor-default"
          >
            <IconText icon="reroll" size={16}>
              Re-roll ({state.rerolls})
            </IconText>
          </button>
          <span className="text-[12px] uppercase tracking-[0.1em] opacity-60">
            <IconText icon="banish" size={14}>
              Banish available: {state.banishes}
            </IconText>
          </span>
        </div>
      </div>
    </div>
  );
}

export function HUD({
  state,
  scores,
  onLock,
  onRestart,
  onClearScores,
  onStartMultiplayer,
  onLeaveRoom,
  onStartSurvivors,
  onStartSandbox,
  onPickUpgrade,
  onReroll,
  onBanish,
  onMenu,
  shop,
  lastRunGold,
  onBuyShop,
  initialRoom,
  suppressMenu = false,
}: Props) {
  const { status, multiplayer, campaign, survivors } = state;

  const showLockPrompt = status === "pointerlock-needed" && !suppressMenu && (campaign || survivors || multiplayer);

  return (
    // `hud-paused` freezes every in-flight HUD animation except the pause overlay's own UI (see styles.css).
    <div className={`absolute inset-0 pointer-events-none z-10${status === "paused" ? " hud-paused" : ""}`}>
      <CombatOverlays state={state} />

      {/* Overlays */}
      {status === "levelup" && (
        <LevelUpDraft state={state} onPick={onPickUpgrade} onReroll={onReroll} onBanish={onBanish} />
      )}

      {showLockPrompt && (
        <button type="button" className="ssg-lock-prompt" onClick={onLock}>
          Click to lock
        </button>
      )}

      <MainMenu
        state={state}
        scores={scores}
        shop={shop}
        suppressMenu={suppressMenu}
        initialRoom={initialRoom}
        onStartSurvivors={onStartSurvivors}
        onStartSandbox={onStartSandbox}
        onStartMultiplayer={onStartMultiplayer}
        onClearScores={onClearScores}
        onBuyShop={onBuyShop}
      />

      <PauseScreens
        state={state}
        suppressMenu={suppressMenu}
        onLock={onLock}
        onRestart={onRestart}
        onLeaveRoom={onLeaveRoom}
        onMenu={onMenu}
      />

      <GameOverScreen
        state={state}
        scores={scores}
        shop={shop}
        lastRunGold={lastRunGold}
        onRestart={onRestart}
        onMenu={onMenu}
        onBuyShop={onBuyShop}
        onClearScores={onClearScores}
      />
    </div>
  );
}
