import { SCOURGE_THREAT_TIERS } from "../../game/data/enemies";
import type { HUDState } from "../../game/types";
import { PixelIcon } from "../PixelIcon";
import { formatTime, HUD_CORNER, IconText, runModeLabel, STAT_LABEL, STAT_SUB, STAT_VALUE } from "./shared";

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

/** Everything drawn during live combat: crosshair, hit feedback, meters, panels. */
// react-doctor-disable-next-line react-doctor/no-giant-component -- The HUD overlay is a cohesive render-only surface with shared transient state.
export function CombatOverlays({ state }: { state: HUDState }) {
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

  const healthFrac = playerHealth / maxPlayerHealth;
  const shieldFrac = state.survivorMaxShield ? state.survivorShield / state.survivorMaxShield : 0;
  const integrityStats = [
    state.survivorArmor > 0 ? { label: "Armor", value: `${state.survivorArmor}%` } : null,
    state.survivorDodge > 0 ? { label: "Evade", value: `${state.survivorDodge}%` } : null,
    state.survivorGrace > 0 ? { label: "Grace", value: `${state.survivorGrace.toFixed(2)}s` } : null,
  ].filter((stat): stat is { label: string; value: string } => Boolean(stat));
  const playing = status === "playing";
  const berserkActive = playing && berserk > 0;
  const bossBannerName = state.bossName ?? SCOURGE_THREAT_TIERS.breachBoss.banner;
  const bossLabel = bossShielded
    ? `${bossBannerName} SHIELD`
    : bossEnraged
      ? `${bossBannerName} FRENZY`
      : bossBannerName;

  return (
    <>
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
                {bossActive ? bossBannerName : `${wave}/${totalWaves}`}
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
        {survivors && (
          <div
            className="scourge-weapon-tier flex items-center justify-end gap-[6px] mb-[4px]"
            data-testid="survivor-weapon-tier"
            title={`Weapon ${state.survivorWeaponTierLabel} — ×${state.survivorWeaponTierDamageMul.toFixed(2)} gun damage`}
            aria-hidden
          >
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#ffb26b]">
              {state.survivorWeaponTierLabel}
            </span>
            <span className="flex items-center gap-[2px]">
              {Array.from({ length: 5 }, (_, i) => (
                <i
                  key={i}
                  className={`inline-block h-[6px] w-[6px] rounded-[1px] ${
                    i <= state.survivorWeaponTierIndex
                      ? "bg-[#ff8f3a] shadow-[0_0_6px_rgba(255,143,58,0.6)]"
                      : "bg-white/15"
                  }`}
                />
              ))}
            </span>
            <span className="text-[10px] font-bold text-accent">×{state.survivorWeaponTierDamageMul.toFixed(2)}</span>
          </div>
        )}
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
    </>
  );
}
