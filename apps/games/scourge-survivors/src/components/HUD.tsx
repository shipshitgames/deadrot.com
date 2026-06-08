import {
  Button,
  Card,
  GlobalGameSettingsPanel,
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
  PauseMenu,
  type PauseMenuAction,
  PixelConfetti,
  UpgradeCard,
  useEnterToReveal,
} from "@shipshitgames/ui";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { SCOURGE_THREAT_TIERS } from "../game/data/enemies";
import {
  SHOP_UPGRADES,
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_GOAL_TIME,
  type SurvivorClassId,
  shopCost,
} from "../game/data/survivors";
import { WEAPON_IDENTITIES } from "../game/data/weaponIdentity";
import { MENU_HERO_URL, PLAYER_AVATAR_PREVIEW_URLS } from "../game/spriteAssets";
import type { ScoreEntry, ShopState } from "../game/storage";
import type { HUDState } from "../game/types";
import { normalizePlayerAvatar, PLAYER_AVATAR_OPTIONS, type PlayerAvatarId } from "../net/playerAvatars";
import { PixelIcon, type PixelIconId } from "./PixelIcon";

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

// ----------------------------------------------------------------- shared utility class strings
const OVERLAY = "ssg-menu-screen";
const HUD_CORNER = "ssg-hud-corner";
const STAT_LABEL = "ssg-stat-label";
const STAT_VALUE = "ssg-stat-value";
const MENU_HEADING = "ssg-section-heading";
const STAT_SUB = "ssg-stat-sub";
const DRAFT_PRESS_MAX_AGE_MS = 1200;
const AVATAR_PREVIEWS: Record<PlayerAvatarId, string> = PLAYER_AVATAR_PREVIEW_URLS;

function savedSurvivorClass(): SurvivorClassId {
  const saved = localStorage.getItem("scourge-survivors.survivorClass");
  return SURVIVOR_CLASS_IDS.includes(saved as SurvivorClassId) ? (saved as SurvivorClassId) : "ranger";
}

function IconText({
  icon,
  children,
  size = 16,
  className = "",
}: {
  icon: PixelIconId;
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-[6px] ${className}`}>
      <PixelIcon id={icon} size={size} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function Shop({ shop, onBuy }: { shop: ShopState; onBuy: (id: string) => void }) {
  return (
    <div
      className="pointer-events-auto w-[min(680px,92vw)] mt-[14px] bg-[rgba(255,209,102,0.05)] border border-[rgba(255,209,102,0.35)] rounded-xl px-4 py-[14px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-[10px]">
        <span className="text-[14px] tracking-[0.08em] uppercase text-[#ffd166]">
          <IconText icon="shop" size={18}>
            Survivors Upgrade Shop
          </IconText>
        </span>
        <span className="text-[16px] font-extrabold text-[#ffd166]">
          <IconText icon="gold" size={19}>
            {shop.gold.toLocaleString()}
          </IconText>
        </span>
      </div>
      <div className="flex flex-col gap-2 max-h-[56vh] overflow-y-auto overscroll-contain pr-1.5">
        {SHOP_UPGRADES.map((u) => {
          const tier = shop.tiers[u.id] ?? 0;
          const maxed = tier >= u.max;
          const cost = shopCost(u, tier);
          const afford = shop.gold >= cost;
          return (
            <Card
              key={u.id}
              title={u.desc}
              className={`flex items-center gap-3 bg-black/30 border-white/10 rounded-[9px] px-3 py-2.5 text-left${maxed ? " opacity-70" : ""}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-black/30">
                <PixelIcon id={u.icon} size={34} label={u.name} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">
                  {u.name}{" "}
                  <span className="text-[11px] opacity-60 font-semibold">
                    {tier}/{u.max}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-[#9b958a] normal-case">{u.desc}</div>
              </div>
              <button
                type="button"
                className="pointer-events-auto cursor-pointer text-[12px] font-extrabold whitespace-nowrap text-[#1a1206] bg-gradient-to-r from-[#ffd166] to-[#ffb02e] rounded-[7px] px-[10px] py-[7px] disabled:cursor-default disabled:bg-white/[0.12] disabled:bg-none disabled:text-[#8a93a6]"
                disabled={maxed || !afford}
                onClick={() => onBuy(u.id)}
              >
                {maxed ? (
                  "MAX"
                ) : (
                  <IconText icon="gold" size={13}>
                    {cost}
                  </IconText>
                )}
              </button>
            </Card>
          );
        })}
      </div>
      <div className="mt-[10px] text-[11px] opacity-60 text-center">
        Permanent upgrades apply to every Survivors run. Earn gold by surviving.
      </div>
    </div>
  );
}

function randomRoom(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `BREACH-${s}`;
}

function MultiplayerPanel({
  onStart,
  initialRoom,
}: {
  onStart: (name: string, room: string, avatar: PlayerAvatarId) => void;
  initialRoom: string;
}) {
  const [name, setName] = useState(() => localStorage.getItem("scourge-survivors.name") || "");
  const [room, setRoom] = useState(initialRoom || "");
  const [avatar, setAvatar] = useState<PlayerAvatarId>(() =>
    normalizePlayerAvatar(localStorage.getItem("scourge-survivors.avatar")),
  );
  const join = () => {
    const n = name.trim() || "Player";
    const r = (room.trim() || randomRoom()).toUpperCase();
    localStorage.setItem("scourge-survivors.name", n);
    localStorage.setItem("scourge-survivors.avatar", avatar);
    onStart(n, r, avatar);
  };
  const input =
    "pointer-events-auto text-[15px] text-fg bg-black/35 border border-white/20 rounded-lg px-3 py-[9px] min-w-[200px] focus:outline-none focus:border-accent";
  return (
    <div
      className="pointer-events-auto mt-4 w-[min(700px,88vw)] bg-[rgba(255,77,109,0.06)] border border-[rgba(255,77,109,0.35)] rounded-[10px] px-5 py-4 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[14px] tracking-[0.1em] uppercase text-[#ff8aa0] mb-[10px]">
        <IconText icon="swords" size={18}>
          Co-op Breach Rooms
        </IconText>
      </div>
      <div className="flex gap-[10px] justify-center flex-wrap">
        <input
          className={input}
          placeholder="Your name"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={input}
          placeholder="Breach code (blank = random)"
          maxLength={20}
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") join();
          }}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {PLAYER_AVATAR_OPTIONS.map((option) => {
          const selected = avatar === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`pointer-events-auto cursor-pointer flex min-h-[158px] flex-col items-center overflow-hidden rounded-lg border px-2.5 py-2.5 text-center transition-[border-color,background,transform,box-shadow] hover:-translate-y-px ${
                selected
                  ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(255,106,0,0.18),0_10px_28px_-18px_rgba(255,106,0,0.9)]"
                  : "border-white/15 bg-black/25 hover:bg-white/10"
              }`}
              onClick={() => setAvatar(option.id)}
              aria-pressed={selected}
            >
              <span
                className={`relative flex h-[108px] w-full items-end justify-center overflow-hidden rounded-md border bg-black/35 ${
                  selected ? "border-accent/60" : "border-white/10"
                }`}
              >
                <span
                  className={`absolute bottom-[8px] h-[24px] w-[74px] rounded-full blur-[10px] ${selected ? "bg-accent/45" : "bg-white/10"}`}
                />
                <span
                  className={`absolute bottom-[7px] h-[14px] w-[64px] rounded-full border ${selected ? "border-accent/75" : "border-white/15"}`}
                />
                <img
                  src={AVATAR_PREVIEWS[option.id]}
                  alt=""
                  className="relative z-[1] h-[104px] w-auto max-w-none object-contain [filter:drop-shadow(0_7px_7px_rgba(0,0,0,0.8))]"
                  draggable={false}
                />
                {selected && (
                  <span className="absolute right-2 top-2 z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-[12px] font-extrabold text-ink">
                    <PixelIcon id="check" size={12} label="Selected" />
                  </span>
                )}
              </span>
              <span className="mt-2 min-w-0">
                <b className="block text-[13px] leading-tight">{option.name}</b>
                <small className="block text-[11px] opacity-65 leading-tight">{option.role}</small>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pointer-events-auto cursor-pointer mt-3 text-[18px] font-bold tracking-[0.04em] text-[#1a0608] bg-gradient-to-r from-[#ff4d6d] to-[#ff8a3c] rounded-[10px] px-[34px] py-[13px] shadow-[0_6px_22px_rgba(255,77,109,0.35)] transition-transform hover:-translate-y-px active:translate-y-px"
        onClick={join}
      >
        <IconText icon="swords" size={19}>
          Join Breach
        </IconText>
      </button>
      <div className="mt-2 text-[12px] opacity-60">Share the breach code so friends can join the same run.</div>
    </div>
  );
}

function SurvivorsPanel({ onStart, onBack }: { onStart: (classId: SurvivorClassId) => void; onBack: () => void }) {
  const [classId, setClassId] = useState<SurvivorClassId>(() => savedSurvivorClass());
  const selected = SURVIVOR_CLASSES[classId];
  const selectedWeapon = WEAPON_IDENTITIES[selected.startingWeapon];
  const launch = () => {
    localStorage.setItem("scourge-survivors.survivorClass", classId);
    onStart(classId);
  };

  return (
    <div className="pointer-events-auto w-[min(940px,92vw)]" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {SURVIVOR_CLASS_IDS.map((id) => {
          const cls = SURVIVOR_CLASSES[id];
          const weapon = WEAPON_IDENTITIES[cls.startingWeapon];
          const active = id === classId;
          return (
            <button
              key={id}
              type="button"
              title={`${cls.desc}\n\nStarting weapon — ${weapon.displayName}: ${weapon.role}`}
              className={`pointer-events-auto cursor-pointer min-h-[188px] rounded-lg border bg-black/30 px-3 py-3 text-left transition-[border-color,background,transform,box-shadow] hover:-translate-y-px ${
                active
                  ? "border-accent bg-accent/12 shadow-[0_0_0_1px_rgba(255,106,0,0.22),0_18px_44px_-28px_rgba(255,106,0,0.9)]"
                  : "border-white/15 hover:bg-white/10"
              }`}
              onClick={() => setClassId(id)}
              aria-pressed={active}
            >
              <span className="relative mb-3 flex h-[120px] items-end justify-center overflow-hidden rounded-md border border-white/10 bg-black/35">
                <span
                  className={`absolute bottom-[8px] h-[20px] w-[78px] rounded-full blur-[10px] ${active ? "bg-accent/45" : "bg-white/10"}`}
                />
                <img
                  src={AVATAR_PREVIEWS[id]}
                  alt=""
                  className="relative z-[1] h-[116px] w-auto max-w-none object-contain [filter:drop-shadow(0_8px_8px_rgba(0,0,0,0.82))]"
                  draggable={false}
                />
              </span>
              <span className="mb-1 flex items-center justify-between gap-2">
                <b className="text-[16px] leading-tight">{cls.name}</b>
                <PixelIcon id={cls.icon} size={20} label={cls.name} />
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#ffb56b]">{cls.role}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-left">
        <div className="text-[12px] uppercase tracking-[0.12em] text-[#ffb56b]">Selected</div>
        <div className="text-[22px] font-black tracking-[0.03em]">{selected.name}</div>
        <div className="text-[12px] opacity-65">
          {selectedWeapon.callsign} · {Math.floor(SURVIVOR_RUN_GOAL_TIME / 60)}:
          {(SURVIVOR_RUN_GOAL_TIME % 60).toString().padStart(2, "0")} breach descent
        </div>
      </div>
      <div className="mt-4 flex items-stretch gap-3">
        <Button type="button" variant="back" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" variant="primary" size="lg" className="flex-1" onClick={launch}>
          Play a Run
        </Button>
      </div>
    </div>
  );
}

function SurvivorsHub({
  shop,
  scores,
  onOperator,
  onShop,
  onCoop,
  onLeaderboard,
  onSettings,
  onStartSandbox,
}: {
  shop: ShopState;
  scores: ScoreEntry[];
  onOperator: () => void;
  onShop: () => void;
  onCoop: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onStartSandbox?: () => void;
}) {
  const [classId] = useState<SurvivorClassId>(() => savedSurvivorClass());
  const selected = SURVIVOR_CLASSES[classId];
  return (
    <MainMenuNav label="Survivors Hub" aria-label="Survivors hub">
      <MainMenuAction
        type="button"
        variant="primary"
        label={
          <IconText icon="target" size={22}>
            Play a Run
          </IconText>
        }
        meta={`${selected.name} · ${Math.floor(SURVIVOR_RUN_GOAL_TIME / 60)}m breach`}
        onClick={onOperator}
      />
      <MainMenuAction
        type="button"
        variant="shop"
        label={
          <IconText icon="shop" size={18}>
            Shop
          </IconText>
        }
        meta={`${shop.gold.toLocaleString()} gold`}
        onClick={onShop}
      />
      <MainMenuAction
        type="button"
        variant="coop"
        label={
          <IconText icon="swords" size={18}>
            Co-op
          </IconText>
        }
        meta="Breach rooms"
        onClick={onCoop}
      />
      <MainMenuAction
        type="button"
        variant="records"
        label={
          <IconText icon="trophy" size={18}>
            Leaderboard
          </IconText>
        }
        meta={scores.length === 0 ? "No records" : "Local archive"}
        onClick={onLeaderboard}
      />
      <MainMenuAction
        type="button"
        variant="settings"
        label={
          <IconText icon="settings" size={18}>
            Settings
          </IconText>
        }
        meta="Audio"
        onClick={onSettings}
      />
      {onStartSandbox && (
        <MainMenuAction
          type="button"
          variant="dev"
          label={
            <IconText icon="gamepad" size={18}>
              Sandbox
            </IconText>
          }
          meta="Dev lab"
          onClick={onStartSandbox}
        />
      )}
      <MainMenuAction
        type="button"
        variant="default"
        label="← Back to Warline"
        meta="Lobby"
        onClick={() => goToWarlineLobby()}
      />
    </MainMenuNav>
  );
}

function Scoreboard({ board, room, connected }: { board: HUDState["scoreboard"]; room: string; connected: boolean }) {
  return (
    <div className="scourge-scoreboard absolute top-[96px] right-[18px] min-w-[190px] border border-white/10 rounded-[2px] px-[10px] py-2 [font-variant-numeric:tabular-nums]">
      <div className="flex justify-between text-[12px] tracking-[0.06em] opacity-85 mb-[5px] pb-1 border-b border-white/10">
        <IconText icon="swords" size={14}>
          {room || "-"}
        </IconText>
        <span className={connected ? "text-good" : "text-warn"}>
          <IconText icon={connected ? "live" : "offline"} size={10}>
            {connected ? "live" : "connecting"}
          </IconText>
        </span>
      </div>
      {board.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 text-[13px] py-[2px]${p.you ? " text-accent font-bold" : ""}`}
        >
          <span className="flex-1 truncate">
            {p.name}
            {p.you ? " (you)" : ""}
          </span>
          <span className="w-[30px] text-right opacity-70">{p.health}</span>
          <span className="w-[24px] text-right font-extrabold">{p.kills}</span>
        </div>
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function runModeLabel(mode?: HUDState["runMode"]): string {
  switch (mode) {
    case "structured":
      return "Structured";
    case "endless":
      return "Endless";
    case "coop":
      return "Co-op";
    case "sandbox":
      return "Sandbox";
    case "campaign":
      return "Campaign";
    default:
      return "Run";
  }
}

function depthLabel(depth?: number, total?: number, name?: string): string {
  if (!depth) return name || "-";
  const count = total && total > 0 ? `${depth}/${total}` : `${depth}`;
  return name ? `${count} · ${name}` : count;
}

function healthColor(frac: number): string {
  if (frac <= 0.28) return "#c1121f";
  if (frac <= 0.58) return "#ff2a18";
  return "#ff6a00";
}

function Crosshair({ berserk = false }: { berserk?: boolean }) {
  const bar = `absolute ${berserk ? "bg-[#ff2a18] shadow-[0_0_8px_rgba(255,42,24,0.95)]" : "bg-white/85 shadow-[0_0_2px_rgba(0,0,0,0.8)]"}`;
  return (
    <div
      className={`scourge-crosshair absolute top-1/2 left-1/2 w-[26px] h-[26px] -translate-x-1/2 -translate-y-1/2${berserk ? " is-berserk" : ""}`}
      aria-hidden
    >
      <span className={`${bar} left-1/2 w-[2px] h-[8px] -translate-x-1/2 top-0`} />
      <span className={`${bar} left-1/2 w-[2px] h-[8px] -translate-x-1/2 bottom-0`} />
      <span className={`${bar} top-1/2 h-[2px] w-[8px] -translate-y-1/2 left-0`} />
      <span className={`${bar} top-1/2 h-[2px] w-[8px] -translate-y-1/2 right-0`} />
      <span
        className={`absolute top-1/2 left-1/2 w-[2px] h-[2px] rounded-full -translate-x-1/2 -translate-y-1/2 ${berserk ? "bg-[#ffd166]" : "bg-accent"}`}
      />
    </div>
  );
}

function HitMarker({ seq, variant }: { seq: number; variant: "hit" | "kill" | "head" }) {
  if (seq <= 0) return null;
  const anim = variant === "kill" ? "animate-hit-kill" : variant === "head" ? "animate-hit-head" : "animate-hit";
  const color =
    variant === "kill"
      ? "bg-danger"
      : variant === "head"
        ? "bg-[#ffd166] shadow-[0_0_6px_rgba(255,209,102,0.9)]"
        : "bg-white";
  const bar = `absolute ${color}`;
  return (
    <div
      key={`${variant}-${seq}`}
      className={`absolute top-1/2 left-1/2 w-[30px] h-[30px] opacity-0 ${anim}`}
      aria-hidden
    >
      <span className={`${bar} left-1/2 w-[3px] h-[10px] -translate-x-1/2 top-0`} />
      <span className={`${bar} left-1/2 w-[3px] h-[10px] -translate-x-1/2 bottom-0`} />
      <span className={`${bar} top-1/2 h-[3px] w-[10px] -translate-y-1/2 left-0`} />
      <span className={`${bar} top-1/2 h-[3px] w-[10px] -translate-y-1/2 right-0`} />
    </div>
  );
}

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

function ReloadRing({ progress }: { progress: number }) {
  return (
    <svg
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
      viewBox="0 0 52 52"
      width="52"
      height="52"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="fill-none [stroke:rgba(255,255,255,0.18)] [stroke-width:3]" cx="26" cy="26" r={RING_R} />
      <circle
        className="fill-none stroke-warn [stroke-width:3] [stroke-linecap:round] [transition:stroke-dashoffset_0.1s_linear]"
        cx="26"
        cy="26"
        r={RING_R}
        style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - progress) }}
      />
    </svg>
  );
}

// Music + SFX volume sliders, sourced from the shared global settings store.
// Self-subscribing, so it needs no props beyond layout spacing.
function SettingsRow({ className = "mt-4" }: { className?: string }) {
  return (
    <div className={`pointer-events-auto flex justify-center ${className}`} onClick={(e) => e.stopPropagation()}>
      <GlobalGameSettingsPanel inline className="w-[min(360px,86vw)]" />
    </div>
  );
}

function Leaderboard({
  scores,
  highlight,
  onClear,
}: {
  scores: ScoreEntry[];
  highlight?: ScoreEntry | null;
  onClear?: () => void;
}) {
  const th = "text-[10px] tracking-[0.08em] uppercase opacity-50 text-right px-[6px] py-[2px] font-semibold";
  const td = "text-[14px] text-right px-[6px] py-[3px]";
  return (
    <div
      className="pointer-events-auto min-w-[320px] bg-white/[0.04] border border-white/10 rounded-[10px] px-[14px] py-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] tracking-[0.1em] uppercase opacity-85">
          <IconText icon="trophy" size={17}>
            Leaderboard
          </IconText>
        </span>
        {onClear && scores.length > 0 && (
          <button
            type="button"
            className="pointer-events-auto cursor-pointer text-[11px] text-[#aab4c2] bg-transparent border border-white/[0.18] rounded-md px-2 py-[2px]"
            onClick={onClear}
          >
            clear
          </button>
        )}
      </div>
      {scores.length === 0 ? (
        <div className="text-[13px] opacity-60 py-2">No runs yet — set the first record.</div>
      ) : (
        <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
          <thead>
            <tr>
              <th className={`${th} !text-center`}>#</th>
              <th className={`${th} !text-left`}>Run</th>
              <th className={th}>Score</th>
              <th className={th}>Kills</th>
              <th className={th}>Lvl</th>
              <th className={th}>Time</th>
              <th className={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {scores.slice(0, 8).map((s, i) => {
              const me =
                highlight &&
                s.score === highlight.score &&
                s.kills === highlight.kills &&
                s.time === highlight.time &&
                s.date === highlight.date;
              return (
                <tr
                  key={s.date + "-" + i}
                  className={me ? "bg-[rgba(255,106,0,0.14)] outline outline-1 outline-[rgba(255,106,0,0.36)]" : ""}
                >
                  <td className={`${td} !text-center`}>{i + 1}</td>
                  <td className={`${td} !text-left`}>
                    <span className="block text-[12px] font-bold uppercase tracking-[0.04em]">
                      {runModeLabel(s.mode)}
                    </span>
                    <span className="block max-w-[150px] truncate text-[10px] opacity-55">
                      {depthLabel(s.depthReached, s.depthTotal, s.depthName)}
                    </span>
                  </td>
                  <td className={td}>{s.score.toLocaleString()}</td>
                  <td className={td}>{s.kills}</td>
                  <td className={td}>{s.level ?? "-"}</td>
                  <td className={td}>{formatTime(s.time)}</td>
                  <td className={`${td} ${s.outcome === "win" ? "text-good font-bold" : "text-[#aab4c2]"}`}>
                    {s.outcome === "win" ? "WIN" : "KO"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SurvivorsHud({ state }: { state: HUDState }) {
  const frac = state.xpToNext > 0 ? state.xp / state.xpToNext : 0;
  return (
    <>
      <div className="ssg-survivor-runline" data-testid="survivors-run-hud" aria-hidden>
        <div className="ssg-survivor-runline__meta">
          <span>
            <IconText icon={state.survivorClassIcon} size={14}>
              {state.survivorClassName}
            </IconText>
          </span>
          <span>{runModeLabel(state.runMode)}</span>
          <span title={state.runDepthName}>
            Depth {state.runDepth}/{state.runDepthTotal}
          </span>
          <span>{formatTime(state.time)}</span>
          <span>{state.kills} kills</span>
        </div>
        <div className="ssg-survivor-runline__chapters">
          {Array.from({ length: state.survivorTotalChapters }, (_, i) => (
            <span key={i} className={i < state.survivorChapter ? "is-active" : ""} />
          ))}
        </div>
      </div>

      <div className="ssg-survivor-xp" aria-hidden>
        <div className="ssg-survivor-xp__level">LV {state.level}</div>
        <div className="ssg-survivor-xp__track">
          <div className="ssg-survivor-xp__fill" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
        </div>
        <div className="ssg-survivor-xp__count">
          {state.xp}/{state.xpToNext}
        </div>
      </div>
      {state.build.length > 0 && (
        <div
          className={`scourge-build-strip${state.berserk > 0 ? " is-berserk-offset" : ""} absolute top-[112px] left-1/2 -translate-x-1/2 flex gap-[6px] flex-wrap justify-center max-w-[70vw]`}
          aria-hidden
        >
          {state.build.map((b) => (
            <span
              key={b.id}
              className={`scourge-build-chip inline-flex items-center gap-[3px] rounded-[2px] px-[7px] py-[2px] ${
                b.evolved ? "text-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.35)]" : ""
              }`}
              title={b.name}
            >
              <PixelIcon id={b.icon} size={17} label={b.name} />
              <b className="text-[11px] text-accent ml-[2px] align-super">{b.level}</b>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

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
  const {
    status,
    playerHealth,
    maxPlayerHealth,
    ammo,
    magazineSize,
    reserve,
    reloading,
    reloadProgress,
    score,
    kills,
    headshots,
    enemiesAlive,
    combo,
    time,
    wave,
    totalWaves,
    campaignStage,
    campaignTotalStages,
    mapName,
    bossActive,
    bossHealthFrac,
    bossShielded,
    bossEnraged,
    outcome,
    weapon,
    weapons,
    berserk,
    berserkFrac,
    dualWeapon,
    ads,
    adsZoom,
    adsZoomLevels,
    hitMarkerSeq,
    headshotSeq,
    killSeq,
    damageSeq,
    banner,
    bannerSeq,
    toast,
    toastSeq,
    damageNumbers,
    multiplayer,
    connected,
    room,
    scoreboard,
    campaign,
    missionTitle,
    missionObjective,
    missionCheckpoint,
    missionExtractionReady,
    survivors,
  } = state;

  type MenuScreen = "home" | "operator" | "multiplayer" | "shop" | "settings" | "leaderboard";
  const [menuScreen, setMenuScreen] = useState<MenuScreen>(initialRoom ? "multiplayer" : "home");
  const [pausePanel, setPausePanel] = useState<"none" | "settings" | "controls">("none");
  const [gameOverPanel, setGameOverPanel] = useState<"summary" | "shop">("summary");
  const firstMenuShow = useRef(true);
  // Reset to the root menu whenever the menu is (re)shown — but a shared
  // `?room=` link drops you straight on the join screen the first time.
  useEffect(() => {
    if (status === "pointerlock-needed") {
      setMenuScreen(firstMenuShow.current && initialRoom ? "multiplayer" : "home");
      firstMenuShow.current = false;
    }
  }, [status, initialRoom]);
  // Always reopen the pause menu on its root screen.
  useEffect(() => {
    if (status !== "paused") setPausePanel("none");
  }, [status]);
  useEffect(() => {
    if (status !== "gameover") setGameOverPanel("summary");
  }, [status]);
  const healthFrac = playerHealth / maxPlayerHealth;
  const shieldFrac = state.survivorMaxShield ? state.survivorShield / state.survivorMaxShield : 0;
  const integrityStats = [
    state.survivorArmor > 0 ? { label: "Armor", value: `${state.survivorArmor}%` } : null,
    state.survivorDodge > 0 ? { label: "Evade", value: `${state.survivorDodge}%` } : null,
    state.survivorGrace > 0 ? { label: "Grace", value: `${state.survivorGrace.toFixed(2)}s` } : null,
  ].filter((stat): stat is { label: string; value: string } => Boolean(stat));
  const playing = status === "playing";
  const berserkActive = playing && berserk > 0;
  const bossLabel = bossShielded
    ? `${SCOURGE_THREAT_TIERS.breachBoss.banner} SHIELD`
    : bossEnraged
      ? `${SCOURGE_THREAT_TIERS.breachBoss.banner} FRENZY`
      : SCOURGE_THREAT_TIERS.breachBoss.banner;
  const currentRun: ScoreEntry | null =
    status === "gameover" && outcome
      ? {
          score,
          kills,
          headshots,
          time,
          outcome,
          mode: state.runMode,
          level: state.level,
          depthReached: state.runDepth,
          depthTotal: state.runDepthTotal,
          depthName: state.runDepthName,
          goldEarned: lastRunGold,
          date: scores.find((s) => s.score === score && s.kills === kills && s.time === time)?.date ?? 0,
        }
      : null;
  const showMainMenu = status === "pointerlock-needed" && !suppressMenu && !campaign && !survivors && !multiplayer;
  // Title splash: hold the menu behind a "press enter to continue" prompt.
  const menuRevealed = useEnterToReveal(showMainMenu && menuScreen === "home");
  const showLockPrompt = status === "pointerlock-needed" && !suppressMenu && (campaign || survivors || multiplayer);

  const menuScreenWrap = "flex flex-col items-center gap-2 mt-[14px] w-full";

  // Status row + real actions for the shared PauseMenu (mirrors the title menu;
  // no shop affordance). Multiplayer surfaces breach/connection info + Leave.
  const pauseStatus: ReactNode = multiplayer ? (
    <>
      <span>
        Breach {room || "-"} · {connected ? "connected" : "connecting…"}
      </span>
      <span>{kills} frags</span>
    </>
  ) : (
    <>
      <span>Score {score.toLocaleString()}</span>
      <span>{bossActive ? SCOURGE_THREAT_TIERS.breachBoss.banner : `Wave ${wave}/${totalWaves}`}</span>
      <span>{kills} kills</span>
    </>
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
    {
      id: "restart",
      label: "Restart Run",
      meta: "New breach",
      variant: "default",
      onSelect: onRestart,
    },
    ...(multiplayer
      ? [
          {
            id: "leave",
            label: "Leave Breach",
            meta: room || "Co-op room",
            variant: "coop" as const,
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
    // `hud-paused` freezes every in-flight HUD animation except the pause overlay's own UI (see styles.css).
    <div className={`absolute inset-0 pointer-events-none z-10${status === "paused" ? " hud-paused" : ""}`}>
      {playing && <Crosshair berserk={berserkActive} />}
      {playing && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-[4px] border border-white/12 bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55"
          aria-hidden
        >
          <span className="font-bold text-[#ffb26b]">Esc</span> · Pause
        </div>
      )}
      {berserkActive && (
        <div className="scourge-berserk-vignette absolute inset-0 pointer-events-none" aria-hidden>
          <span className="scourge-berserk-vignette__slash scourge-berserk-vignette__slash--a" />
          <span className="scourge-berserk-vignette__slash scourge-berserk-vignette__slash--b" />
        </div>
      )}
      {playing && combo >= 3 && (
        <div
          key={`combo-${combo}`}
          className="scourge-combo-counter absolute top-[38%] left-1/2 font-black tabular-nums leading-none pointer-events-none select-none animate-combopop"
          style={{
            fontSize: `${Math.min(26 + combo * 1.3, 60)}px`,
            color: combo >= 25 ? "#ff2d55" : combo >= 12 ? "#ff6a00" : "#ffd166",
            textShadow: "0 0 18px rgba(255,106,0,0.85), 0 2px 8px rgba(0,0,0,0.7)",
          }}
          aria-hidden
        >
          {combo}
          <span className="scourge-combo-counter__label text-[0.42em] align-top ml-[3px] opacity-80">COMBO</span>
        </div>
      )}
      {playing && reloading && <ReloadRing progress={reloadProgress} />}
      <HitMarker seq={hitMarkerSeq} variant="hit" />
      <HitMarker seq={headshotSeq} variant="head" />
      <HitMarker seq={killSeq} variant="kill" />
      {damageSeq > 0 && (
        <div
          key={`d-${damageSeq}`}
          className="absolute inset-0 pointer-events-none opacity-0 animate-dmg bg-[radial-gradient(ellipse_at_center,rgba(255,0,40,0)_45%,rgba(255,0,40,0.45)_100%)]"
          aria-hidden
        />
      )}

      {bannerSeq > 0 && status !== "gameover" && (
        <div
          key={`b-${bannerSeq}`}
          className="scourge-combat-banner absolute top-[26%] left-1/2 text-[64px] font-black text-white opacity-0 whitespace-nowrap animate-bannerpop [text-shadow:0_0_24px_rgba(255,106,0,0.72),0_4px_14px_rgba(0,0,0,0.6)]"
          aria-hidden
        >
          {banner}
        </div>
      )}
      {toastSeq > 0 && playing && (
        <div
          key={`t-${toastSeq}`}
          className={`scourge-combat-toast absolute bottom-[23%] left-1/2 text-[24px] font-extrabold opacity-0 whitespace-nowrap animate-toastpop ${
            toast.includes("HEADSHOT")
              ? "text-[#ffd166] [text-shadow:0_0_18px_rgba(255,209,102,0.9),0_2px_8px_rgba(0,0,0,0.6)]"
              : toast.includes("BERSERK")
                ? "text-[#ff2a18] [text-shadow:0_0_24px_rgba(255,42,24,0.96),0_2px_10px_rgba(0,0,0,0.78)]"
                : "text-white [text-shadow:0_0_16px_rgba(255,106,0,0.72),0_2px_8px_rgba(0,0,0,0.6)]"
          }`}
          aria-hidden
        >
          {toast}
        </div>
      )}

      {playing &&
        damageNumbers.map((d) => (
          <div
            key={d.id}
            className={`scourge-damage-number scourge-damage-number--${d.kind} absolute pointer-events-none font-extrabold whitespace-nowrap animate-dmgnum`}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
            aria-hidden
          >
            {d.amount}
            {d.kind === "head" ? (
              "!"
            ) : d.kind === "crit" ? (
              <PixelIcon id="evolution" size={15} className="ml-[3px]" />
            ) : (
              ""
            )}
          </div>
        ))}

      {berserkActive && (
        <div className="scourge-berserk-meter absolute top-[130px] left-1/2" aria-hidden>
          <span className="scourge-berserk-meter__text">
            <IconText icon="lightning" size={16}>
              BERSERK MODE
            </IconText>
            <b>{berserk}s</b>
          </span>
          <span className="scourge-berserk-meter__bar">
            <i style={{ width: `${Math.max(0, Math.min(1, berserkFrac)) * 100}%` }} />
          </span>
        </div>
      )}
      {playing && dualWeapon > 0 && (
        <div
          className={`scourge-dual-weapon${berserkActive ? " is-berserk-offset" : ""} absolute top-[166px] left-1/2 -translate-x-1/2 px-4 py-[6px] rounded-[2px] border border-[rgba(215,210,196,0.55)] text-[#e7dfca] text-[13px] font-bold [text-shadow:0_0_10px_rgba(215,210,196,0.48)]`}
          aria-hidden
        >
          <IconText icon="swords" size={16}>
            DUAL WEAPON · {dualWeapon}s
          </IconText>
        </div>
      )}

      {playing && multiplayer && <Scoreboard board={scoreboard} room={room} connected={connected} />}
      {playing && survivors && <SurvivorsHud state={state} />}

      {!survivors && (
        <div
          className={`${HUD_CORNER} scourge-top-stats top-4 left-1/2 -translate-x-1/2 flex flex-wrap gap-x-[22px] gap-y-[4px] items-center justify-center text-center`}
        >
          <div>
            <div className={STAT_LABEL}>Time</div>
            <div className={`${STAT_VALUE} text-[30px]`}>{formatTime(time)}</div>
          </div>
          {!multiplayer && campaignTotalStages > 1 && (
            <div>
              <div className={STAT_LABEL}>Stage</div>
              <div className={STAT_VALUE}>
                {campaignStage}/{campaignTotalStages}
              </div>
              <div className={STAT_SUB}>{mapName}</div>
            </div>
          )}
          {campaign && missionObjective && (
            <div className="max-w-[220px]" title={missionObjective}>
              <div className={STAT_LABEL}>{missionTitle || "Mission"}</div>
              <div className={`${STAT_VALUE} !text-[16px] leading-tight`}>
                {missionExtractionReady ? "EXTRACT" : "SEVER RELAY"}
              </div>
              {missionCheckpoint && <div className={STAT_SUB}>{missionCheckpoint}</div>}
            </div>
          )}
          {!multiplayer && (
            <div>
              <div className={STAT_LABEL}>Wave</div>
              <div className={`${STAT_VALUE}${bossActive ? " text-danger tracking-[0.1em] animate-bosspulse" : ""}`}>
                {bossActive ? SCOURGE_THREAT_TIERS.breachBoss.banner : `${wave}/${totalWaves}`}
              </div>
            </div>
          )}
          {!multiplayer && (
            <div>
              <div className={STAT_LABEL}>Score</div>
              <div className={STAT_VALUE}>{score.toLocaleString()}</div>
            </div>
          )}
          <div>
            <div className={STAT_LABEL}>{multiplayer ? "Frags" : "Kills"}</div>
            <div className={STAT_VALUE}>{kills}</div>
          </div>
          <div>
            <div className={STAT_LABEL}>HS</div>
            <div className={STAT_VALUE}>{headshots}</div>
          </div>
          {!multiplayer && (
            <div>
              <div className={STAT_LABEL}>Enemies</div>
              <div className={STAT_VALUE}>{enemiesAlive}</div>
            </div>
          )}
        </div>
      )}

      {bossActive && (
        <div className="absolute top-[96px] left-1/2 -translate-x-1/2 w-[min(620px,70vw)] text-center">
          <div
            className={`scourge-boss-label text-[13px] mb-[5px] ${
              bossShielded
                ? "text-good [text-shadow:0_0_12px_rgba(139,220,31,0.75)]"
                : bossEnraged
                  ? "text-[#ff7a3c] [text-shadow:0_0_12px_rgba(255,122,60,0.9)]"
                  : "text-danger [text-shadow:0_0_10px_rgba(255,77,109,0.7)]"
            }`}
          >
            ◆ {bossLabel} ◆
          </div>
          <div className="relative h-4 bg-white/[0.12] border border-[rgba(255,77,109,0.5)] rounded-lg overflow-hidden">
            <div
              className={`absolute inset-0 w-full transition-[width] duration-[120ms] ease-linear ${
                bossShielded
                  ? "bg-gradient-to-r from-good to-toxic shadow-[0_0_16px_rgba(139,220,31,0.75)]"
                  : "bg-gradient-to-r from-[#ff1f4f] to-[#ff7a3c] shadow-[0_0_14px_rgba(255,31,79,0.8)]"
              }`}
              style={{ width: `${Math.max(0, bossHealthFrac) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className={`${HUD_CORNER} scourge-health-panel left-[18px] bottom-[18px] min-w-[214px]`}>
        <div className="scourge-integrity-head">
          <span className={STAT_LABEL}>{survivors ? "Integrity" : "Health"}</span>
          {survivors && state.survivorMaxShield > 0 && (
            <span>
              Shield {state.survivorShield}/{state.survivorMaxShield}
            </span>
          )}
        </div>
        <div className="scourge-integrity-stack">
          {survivors && state.survivorMaxShield > 0 && (
            <div className="scourge-shield-bar">
              <div style={{ width: `${Math.max(0, Math.min(1, shieldFrac)) * 100}%` }} />
            </div>
          )}
          <div className="flex items-center gap-[10px]">
            <div className="scourge-health-bar relative w-[150px] h-[14px] overflow-hidden">
              <div
                className="absolute inset-0 [transition:width_0.15s_linear,background_0.2s_linear]"
                style={{ width: `${Math.max(0, healthFrac) * 100}%`, background: healthColor(healthFrac) }}
              />
            </div>
            <div className={`${STAT_VALUE} !text-[18px]`}>{playerHealth}</div>
          </div>
        </div>
        {survivors && integrityStats.length > 0 && (
          <div className="scourge-integrity-meta">
            {integrityStats.map((stat) => (
              <span key={stat.label}>
                {stat.label} <b>{stat.value}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className={`${HUD_CORNER} scourge-weapon-panel right-[18px] bottom-[18px] text-right min-w-[178px]`}
        data-testid="weapon-panel"
      >
        <div className="text-[13px] tracking-[0.12em] uppercase text-accent mb-[2px]">{weapon}</div>
        <div className="flex items-baseline justify-end gap-[6px]">
          <span className={`text-[30px] font-extrabold${ammo === 0 ? " text-danger" : ""}`}>{ammo}</span>
          <span className="text-[16px] opacity-70">/ {survivors ? magazineSize : reserve}</span>
        </div>
        {reloading ? (
          <div className="mt-[6px] flex flex-col items-end gap-[3px] text-warn text-[12px] tracking-[0.08em] uppercase">
            <div className="w-[120px] h-[5px] bg-white/[0.15] rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-warn rounded-[2px] transition-[width] duration-100 ease-linear"
                style={{ width: `${reloadProgress * 100}%` }}
              />
            </div>
            <span>Reloading…</span>
          </div>
        ) : (
          ammo === 0 && (
            <div className="mt-[5px] text-danger text-[12px] tracking-[0.06em] uppercase animate-blink">
              Press R to reload
            </div>
          )
        )}
        {ads && adsZoomLevels > 1 && (
          <div className="mt-[6px] text-[11px] opacity-55 tracking-[0.04em]">
            Zoom {adsZoom}/{adsZoomLevels}
          </div>
        )}
        {weapons.length > 1 && (
          <div className="flex flex-wrap justify-end gap-[5px] mt-2 max-w-[220px]">
            {weapons.map((w) => (
              <span
                key={w.id}
                className={`text-[11px] px-[7px] py-[2px] rounded-[2px] whitespace-nowrap ${
                  w.active
                    ? "opacity-100 bg-[rgba(255,106,0,0.12)] text-[#ffd166] shadow-[0_0_14px_rgba(255,106,0,0.22)]"
                    : "opacity-70 bg-white/[0.05]"
                }`}
              >
                <b className="text-accent mr-[2px]">{w.key}</b> {w.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Overlays */}
      {status === "levelup" && (
        <LevelUpDraft state={state} onPick={onPickUpgrade} onReroll={onReroll} onBanish={onBanish} />
      )}

      {showLockPrompt && (
        <button type="button" className="ssg-lock-prompt" onClick={onLock}>
          Click to lock
        </button>
      )}

      {showMainMenu && (
        <MainMenuScreen className="cursor-default overflow-y-auto" backgroundImage={MENU_HERO_URL}>
          <MainMenuTopBar mark="SSG" meta={`${shop.gold.toLocaleString()} gold`} aria-hidden>
            Ashgate breach
          </MainMenuTopBar>

          {menuScreen === "home" ? (
            <MainMenuLayout className={menuRevealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
              <MainMenuCopy hidden={menuRevealed}>
                <div className="ssg-menu-kicker">Pyre breach hub</div>
                <MainMenuTitle className="ssg-main-menu-title--pixel">
                  <MainMenuTitleLine>SCOURGE</MainMenuTitleLine>
                  <MainMenuTitleLine tone="hot">SURVIVORS</MainMenuTitleLine>
                </MainMenuTitle>
                <MainMenuStatus>
                  <span>Survivors core online</span>
                  <span>{scores.length === 0 ? "No records" : `${scores.length} local records`}</span>
                </MainMenuStatus>
              </MainMenuCopy>

              {menuRevealed ? (
                <SurvivorsHub
                  shop={shop}
                  scores={scores}
                  onOperator={() => setMenuScreen("operator")}
                  onShop={() => setMenuScreen("shop")}
                  onCoop={() => setMenuScreen("multiplayer")}
                  onLeaderboard={() => setMenuScreen("leaderboard")}
                  onSettings={() => setMenuScreen("settings")}
                  onStartSandbox={onStartSandbox}
                />
              ) : (
                <MainMenuEnterPrompt />
              )}
            </MainMenuLayout>
          ) : (
            <div className="scourge-menu-content">
              {menuScreen === "operator" && (
                <div className={menuScreenWrap}>
                  <div className={MENU_HEADING}>Operator Loadout</div>
                  <SurvivorsPanel onStart={onStartSurvivors} onBack={() => setMenuScreen("home")} />
                </div>
              )}

              {menuScreen === "shop" && (
                <div className={menuScreenWrap}>
                  <div className={MENU_HEADING}>
                    <IconText icon="shop" size={18}>
                      Shop
                    </IconText>
                  </div>
                  <Shop shop={shop} onBuy={onBuyShop} />
                  <Button
                    type="button"
                    variant="back"
                    className="w-[min(260px,80vw)] self-center mt-[14px]"
                    onClick={() => setMenuScreen("home")}
                  >
                    ← Back
                  </Button>
                </div>
              )}

              {menuScreen === "multiplayer" && (
                <div className={menuScreenWrap}>
                  <div className={MENU_HEADING}>
                    <IconText icon="swords" size={18}>
                      Co-op
                    </IconText>
                  </div>
                  <MultiplayerPanel onStart={onStartMultiplayer} initialRoom={initialRoom} />
                  <Button
                    type="button"
                    variant="back"
                    className="w-[min(260px,80vw)] self-center mt-[14px]"
                    onClick={() => setMenuScreen("home")}
                  >
                    ← Back
                  </Button>
                </div>
              )}

              {menuScreen === "settings" && (
                <div className={menuScreenWrap}>
                  <div className={MENU_HEADING}>
                    <IconText icon="settings" size={18}>
                      Settings
                    </IconText>
                  </div>
                  <SettingsRow />
                  <Button
                    type="button"
                    variant="back"
                    className="w-[min(260px,80vw)] self-center mt-[14px]"
                    onClick={() => setMenuScreen("home")}
                  >
                    ← Back
                  </Button>
                </div>
              )}

              {menuScreen === "leaderboard" && (
                <div className={menuScreenWrap}>
                  <div className={MENU_HEADING}>
                    <IconText icon="trophy" size={18}>
                      Leaderboard
                    </IconText>
                  </div>
                  <Leaderboard scores={scores} onClear={onClearScores} />
                  <Button
                    type="button"
                    variant="back"
                    className="w-[min(260px,80vw)] self-center mt-[14px]"
                    onClick={() => setMenuScreen("home")}
                  >
                    ← Back
                  </Button>
                </div>
              )}
            </div>
          )}
          <GlobalMusicToggle className="ssg-music-toggle--corner" />
        </MainMenuScreen>
      )}

      {status === "paused" && !suppressMenu && pausePanel === "none" && (
        <PauseMenu
          open
          className="pause-ui"
          kicker={multiplayer ? "Breach run" : "Pyre breach"}
          title="Paused"
          subtitle={
            multiplayer
              ? "Hold the line — the breach keeps churning while you regroup."
              : "The breach is held in stasis. Catch your breath, operator."
          }
          status={pauseStatus}
          onResume={onLock}
          actions={pauseActions}
        />
      )}

      {status === "paused" && !suppressMenu && pausePanel === "settings" && (
        <div className={OVERLAY} onClick={onLock}>
          <h2 className="m-0 mb-[18px] text-[30px] font-bold">
            <IconText icon="settings" size={26}>
              Settings
            </IconText>
          </h2>
          <SettingsRow className="mt-0" />
          <div
            className="pause-ui mt-[22px] w-[min(340px,86vw)] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Button type="button" variant="ghost" className="w-full" onClick={() => setPausePanel("none")}>
              ← Back
            </Button>
          </div>
        </div>
      )}

      {status === "paused" && !suppressMenu && pausePanel === "controls" && (
        <div className={OVERLAY} onClick={onLock}>
          <h2 className="m-0 mb-[18px] text-[30px] font-bold">
            <IconText icon="gamepad" size={26}>
              Controls
            </IconText>
          </h2>
          <div
            className="pause-ui flex flex-col gap-[10px] w-[min(340px,86vw)] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
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
                Melee
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

      {status === "gameover" && (
        <div className={`${OVERLAY} cursor-default`}>
          {gameOverPanel === "shop" && survivors ? (
            <>
              <div className="tracking-[0.35em] text-[13px] opacity-60 uppercase mb-[10px]">Permanent upgrades</div>
              <h1 className="m-0 mb-[10px] text-[44px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r from-[#ffd166] to-[#ff6a00]">
                SHOP
              </h1>
              <Shop shop={shop} onBuy={onBuyShop} />
              <div className="flex gap-3 mt-4">
                <Button variant="ghost" onClick={() => setGameOverPanel("summary")} type="button">
                  <IconText icon="back" size={16}>
                    Run Summary
                  </IconText>
                </Button>
                <Button variant="default" onClick={onRestart} type="button">
                  <IconText icon="restart" size={16}>
                    Play Again
                  </IconText>
                </Button>
                <Button variant="ghost" onClick={onMenu} type="button">
                  <IconText icon="menu" size={16}>
                    Main Menu
                  </IconText>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="tracking-[0.5em] text-[13px] opacity-60 uppercase mb-[10px]">
                {survivors
                  ? outcome === "win"
                    ? `${runModeLabel(state.runMode)} run — breach sealed`
                    : `${runModeLabel(state.runMode)} run — operator signal gone`
                  : outcome === "win"
                    ? "Breach-boss down — run cleared"
                    : "You were overrun"}
              </div>
              <h1
                className={`m-0 mb-[6px] text-[52px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r ${
                  outcome === "win" ? "from-good to-[#b6ff8a]" : "from-danger to-[#ff9a3c]"
                }`}
              >
                {survivors ? "RUN SUMMARY" : outcome === "win" ? "VICTORY" : "GAME OVER"}
              </h1>
              {survivors && (
                <div className="mb-[14px] w-[min(720px,92vw)] rounded-lg border border-white/10 bg-black/35 px-4 py-3">
                  <div className="grid grid-cols-2 gap-3 text-left md:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <div className={STAT_LABEL}>Mode</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>{runModeLabel(state.runMode)}</div>
                      <div className={STAT_SUB}>{outcome === "win" ? "sealed" : "lost"}</div>
                    </div>
                    <div>
                      <div className={STAT_LABEL}>Depth</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>
                        {state.runDepth}/{state.runDepthTotal}
                      </div>
                      <div className={STAT_SUB}>{state.runDepthName}</div>
                    </div>
                    <div>
                      <div className={STAT_LABEL}>Operator</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>
                        <IconText icon={state.survivorClassIcon} size={20}>
                          {state.survivorClassName}
                        </IconText>
                      </div>
                      <div className={STAT_SUB}>{state.survivorClassRole}</div>
                    </div>
                    <div>
                      <div className={STAT_LABEL}>Level</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>{state.level}</div>
                      <div className={STAT_SUB}>
                        {state.survivorEvolved.length ? `${state.survivorEvolved.length} evolved` : "no evolutions"}
                      </div>
                    </div>
                    <div>
                      <div className={STAT_LABEL}>Kills</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>{kills}</div>
                      <div className={STAT_SUB}>{headshots} headshots</div>
                    </div>
                    <div>
                      <div className={STAT_LABEL}>Gold</div>
                      <div className={`${STAT_VALUE} !text-[20px]`}>
                        <IconText icon="gold" size={18}>
                          +{lastRunGold.toLocaleString()}
                        </IconText>
                      </div>
                      <div className={STAT_SUB}>saved to shop</div>
                    </div>
                  </div>
                  {state.survivorEvolved.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {state.survivorEvolved.map((name) => (
                        <span
                          key={name}
                          className="rounded-md border border-[#ffd166]/45 bg-[#ffd166]/10 px-2 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[#ffd166]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  {state.build.length > 0 && (
                    <div className="mt-3 flex max-w-full flex-wrap justify-center gap-1.5">
                      {state.build.slice(0, 14).map((b) => (
                        <span
                          key={b.id}
                          className={`inline-flex items-center gap-[5px] rounded-md border px-2 py-1 text-[12px] ${
                            b.evolved ? "border-[#ffd166]/50 text-[#ffd166]" : "border-white/15 text-white/75"
                          }`}
                          title={b.name}
                        >
                          <PixelIcon id={b.icon} size={15} label={b.name} /> {b.level}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-9 my-[14px] mb-[26px]">
                <div>
                  <div className={STAT_LABEL}>Score</div>
                  <div className={`${STAT_VALUE} !text-[34px]`}>{score.toLocaleString()}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Kills</div>
                  <div className={`${STAT_VALUE} !text-[34px]`}>{kills}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Headshots</div>
                  <div className={`${STAT_VALUE} !text-[34px]`}>{headshots}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Time</div>
                  <div className={`${STAT_VALUE} !text-[34px]`}>{formatTime(time)}</div>
                </div>
              </div>
              {survivors && lastRunGold > 0 && (
                <div className="my-[6px] mb-[10px] text-[#ffd166] text-[16px] font-bold [text-shadow:0_0_12px_rgba(255,209,102,0.6)]">
                  <IconText icon="gold" size={18}>
                    +{lastRunGold.toLocaleString()} gold earned · spend it in the Shop
                  </IconText>
                </div>
              )}
              <Leaderboard scores={scores} highlight={currentRun} onClear={onClearScores} />
              <div className="flex gap-3 mt-4">
                <Button variant="default" onClick={onRestart} type="button">
                  <IconText icon="restart" size={16}>
                    Play Again
                  </IconText>
                </Button>
                {survivors && (
                  <Button variant="ghost" onClick={() => setGameOverPanel("shop")} type="button">
                    <IconText icon="shop" size={16}>
                      Shop
                    </IconText>
                  </Button>
                )}
                <Button variant="ghost" onClick={onMenu} type="button">
                  <IconText icon="menu" size={16}>
                    Main Menu
                  </IconText>
                </Button>
              </div>
            </>
          )}
          <SettingsRow />
        </div>
      )}
    </div>
  );
}
