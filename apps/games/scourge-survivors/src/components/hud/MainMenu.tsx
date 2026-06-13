import { codexEntriesForGame } from "@deadrot/game-kit";
import {
  Button,
  Card,
  CodexScreen,
  GameAudioSettingsScreen,
  GameJumpMenu,
  GameMenuTitle,
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
  MainMenuTopBar,
  MenuKicker,
  useEnterToReveal,
} from "@shipshitgames/ui";
import { useRef, useState } from "react";
import { MAP_PICKER, normalizeMapId } from "../../game/data/maps";
import {
  SHOP_UPGRADES,
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_GOAL_TIME,
  type SurvivorClassId,
  shopCost,
} from "../../game/data/survivors";
import { WEAPON_IDENTITIES } from "../../game/data/weaponIdentity";
import { MENU_HERO_URL, PLAYER_AVATAR_PREVIEW_URLS } from "../../game/spriteAssets";
import type { ScoreEntry, ShopState } from "../../game/storage";
import type { HUDState } from "../../game/types";
import { normalizePlayerAvatar, PLAYER_AVATAR_OPTIONS, type PlayerAvatarId } from "../../net/playerAvatars";
import { PixelIcon } from "../PixelIcon";
import { IconText, Leaderboard, MENU_HEADING } from "./shared";

// Static lore mapping — hoisted so the per-frame HUD re-renders don't rebuild
// the entry objects (and CodexScreen's internal memo keeps a stable identity).
const CODEX_ENTRIES = codexEntriesForGame("scourge-survivors");
const GAME_SLUG = "scourge-survivors";
const menu = gameMenuConfig(GAME_SLUG);

const AVATAR_PREVIEWS: Record<PlayerAvatarId, string> = PLAYER_AVATAR_PREVIEW_URLS;

function savedSurvivorClass(): SurvivorClassId {
  const saved = localStorage.getItem("scourge-survivors.survivorClass");
  return SURVIVOR_CLASS_IDS.includes(saved as SurvivorClassId) ? (saved as SurvivorClassId) : "ranger";
}

function savedMapId(): string {
  return normalizeMapId(localStorage.getItem("scourge-survivors.mapId"));
}

export function Shop({ shop, onBuy }: { shop: ShopState; onBuy: (id: string) => void }) {
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
          aria-label="Your name"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={input}
          placeholder="Breach code (blank = random)"
          aria-label="Breach code"
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

function SurvivorsPanel({ onNext, onBack }: { onNext: (classId: SurvivorClassId) => void; onBack: () => void }) {
  const [classId, setClassId] = useState<SurvivorClassId>(() => savedSurvivorClass());
  const selected = SURVIVOR_CLASSES[classId];
  const selectedWeapon = WEAPON_IDENTITIES[selected.startingWeapon];
  const next = () => {
    localStorage.setItem("scourge-survivors.survivorClass", classId);
    onNext(classId);
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
        <Button type="button" variant="primary" size="lg" className="flex-1" onClick={next}>
          Choose Breach Site →
        </Button>
      </div>
    </div>
  );
}

/** Pre-run map select: the picked breach site holds for the entire run (#276). */
function MapSelectPanel({
  classId,
  onStart,
  onBack,
}: {
  classId: SurvivorClassId;
  onStart: (classId: SurvivorClassId, mapId: string) => void;
  onBack: () => void;
}) {
  const [mapId, setMapId] = useState<string>(() => savedMapId());
  const selected = MAP_PICKER.find((m) => m.id === mapId) ?? MAP_PICKER[0];
  const selectedClass = SURVIVOR_CLASSES[classId];
  const launch = () => {
    localStorage.setItem("scourge-survivors.mapId", selected.id);
    onStart(classId, selected.id);
  };

  return (
    <div className="pointer-events-auto w-[min(940px,92vw)]" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {MAP_PICKER.map((m) => {
          const active = m.id === selected.id;
          return (
            <button
              key={m.id}
              type="button"
              title={m.subtitle}
              className={`pointer-events-auto cursor-pointer min-h-[168px] rounded-lg border bg-black/30 px-3 py-3 text-left transition-[border-color,background,transform,box-shadow] hover:-translate-y-px ${
                active
                  ? "border-accent bg-accent/12 shadow-[0_0_0_1px_rgba(255,106,0,0.22),0_18px_44px_-28px_rgba(255,106,0,0.9)]"
                  : "border-white/15 hover:bg-white/10"
              }`}
              onClick={() => setMapId(m.id)}
              aria-pressed={active}
            >
              <span
                className={`relative mb-3 flex h-[96px] items-center justify-center overflow-hidden rounded-md border bg-black/35 ${
                  active ? "border-accent/60" : "border-white/10"
                }`}
              >
                <span
                  className="absolute inset-0 opacity-25"
                  style={{ background: `radial-gradient(circle at 50% 70%, ${m.accent}, transparent 72%)` }}
                />
                <PixelIcon id={m.icon} size={56} label={m.name} />
              </span>
              <span className="mb-1 block">
                <b className="text-[16px] leading-tight">{m.name}</b>
              </span>
              <span className="block text-[11px] leading-snug opacity-65 normal-case">{m.subtitle}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-left">
        <div className="text-[12px] uppercase tracking-[0.12em] text-[#ffb56b]">Breach Site</div>
        <div className="text-[22px] font-black tracking-[0.03em]">{selected.name}</div>
        <div className="text-[12px] opacity-65">
          {selectedClass.name} · the site holds for the whole descent — no mid-run map swaps
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
  onCodex,
  onSettings,
  onStartSandbox,
}: {
  shop: ShopState;
  scores: ScoreEntry[];
  onOperator: () => void;
  onShop: () => void;
  onCoop: () => void;
  onLeaderboard: () => void;
  onCodex: () => void;
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
        variant="default"
        label={
          <IconText icon="skull" size={18}>
            Codex
          </IconText>
        }
        meta="War dossiers"
        onClick={onCodex}
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
        label={menu.backToWarlineLabel}
        meta={menu.backToWarlineMeta}
        onClick={() => goToWarlineLobby()}
      />
      <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} />
    </MainMenuNav>
  );
}

/** Title splash + hub menus (operator loadout, shop, co-op, leaderboard, settings). */
export function MainMenu({
  state,
  scores,
  shop,
  suppressMenu,
  initialRoom,
  onStartSurvivors,
  onStartSandbox,
  onStartMultiplayer,
  onClearScores,
  onBuyShop,
}: {
  state: HUDState;
  scores: ScoreEntry[];
  shop: ShopState;
  suppressMenu: boolean;
  initialRoom: string;
  onStartSurvivors: (classId?: SurvivorClassId, mapId?: string) => void;
  onStartSandbox?: () => void;
  onStartMultiplayer: (name: string, room: string, avatar: PlayerAvatarId) => void;
  onClearScores: () => void;
  onBuyShop: (id: string) => void;
}) {
  const { status, campaign, survivors, multiplayer } = state;

  type MenuScreen = "home" | "operator" | "mapselect" | "multiplayer" | "shop" | "settings" | "leaderboard" | "codex";
  const [menuScreen, setMenuScreen] = useState<MenuScreen>(initialRoom ? "multiplayer" : "home");
  // Class confirmed on the operator screen, carried into the map select step.
  const [pendingClassId, setPendingClassId] = useState<SurvivorClassId>(() => savedSurvivorClass());
  // Reset to the root menu whenever the menu is re-shown, adjusted inline
  // during render so the old screen never paints. The `?room=` deep link only
  // applies to the initial mount, which the useState initializer handles.
  const prevStatusRef = useRef(status);
  if (status !== prevStatusRef.current) {
    prevStatusRef.current = status;
    if (status === "pointerlock-needed") setMenuScreen("home");
  }

  const showMainMenu = status === "pointerlock-needed" && !suppressMenu && !campaign && !survivors && !multiplayer;
  // Title splash: hold the menu behind a "press enter to continue" prompt.
  const menuRevealed = useEnterToReveal(showMainMenu && menuScreen === "home");

  const menuScreenWrap = "flex flex-col items-center gap-2 mt-[14px] w-full";

  if (!showMainMenu) return null;

  return (
    <MainMenuScreen className="cursor-default overflow-y-auto" backgroundImage={MENU_HERO_URL}>
      <MainMenuTopBar mark="SSG" meta={`${shop.gold.toLocaleString()} gold`} aria-hidden>
        {menu.topBar}
      </MainMenuTopBar>

      {menuScreen === "home" ? (
        <MainMenuLayout className={menuRevealed ? "ssg-main-menu-layout--menu" : "ssg-main-menu-layout--splash"}>
          <MainMenuCopy hidden={menuRevealed}>
            <MenuKicker>{menu.titleKicker}</MenuKicker>
            <GameMenuTitle config={menu} />
            <p className="ssg-main-menu-subtitle">{menu.titleSubtitle}</p>
            <MainMenuStatus>
              {menu.titleStatus.map((item) => (
                <span key={item}>{item}</span>
              ))}
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
              onCodex={() => setMenuScreen("codex")}
              onSettings={() => setMenuScreen("settings")}
              onStartSandbox={onStartSandbox}
            />
          ) : (
            <>
              <MainMenuEnterPrompt />
              <GameJumpMenu currentSlug={GAME_SLUG} label={menu.fastTravelLabel} className="ssg-game-jump--splash" />
            </>
          )}
        </MainMenuLayout>
      ) : (
        <div className="scourge-menu-content">
          {menuScreen === "operator" && (
            <div className={menuScreenWrap}>
              <div className={MENU_HEADING}>Operator Loadout</div>
              <SurvivorsPanel
                onNext={(classId) => {
                  setPendingClassId(classId);
                  setMenuScreen("mapselect");
                }}
                onBack={() => setMenuScreen("home")}
              />
            </div>
          )}

          {menuScreen === "mapselect" && (
            <div className={menuScreenWrap}>
              <div className={MENU_HEADING}>Breach Site</div>
              <MapSelectPanel
                classId={pendingClassId}
                onStart={onStartSurvivors}
                onBack={() => setMenuScreen("operator")}
              />
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
            <GameAudioSettingsScreen
              open
              slug={GAME_SLUG}
              onClose={() => setMenuScreen("home")}
              backgroundImage={MENU_HERO_URL}
            />
          )}

          {menuScreen === "codex" && (
            <CodexScreen
              open
              onClose={() => setMenuScreen("home")}
              kicker={menu.codexKicker}
              backgroundImage={MENU_HERO_URL}
              entries={CODEX_ENTRIES}
            />
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
  );
}
