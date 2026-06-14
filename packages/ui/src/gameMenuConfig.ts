import type { GameSlug } from "@deadrot/catalog";

export type GameMenuTitleTone = "bone" | "hot" | "ember";

export interface GameMenuTitleLineConfig {
  text: string;
  tone?: GameMenuTitleTone;
}

export interface GameMenuConfig {
  slug: GameSlug;
  topBar: string;
  titleKicker: string;
  titleLines: readonly GameMenuTitleLineConfig[];
  titleSubtitle: string;
  titleStatus: readonly string[];
  settingsKicker: string;
  codexKicker: string;
  pauseKicker: string;
  pauseSubtitle: string;
  backToWarlineLabel: string;
  backToWarlineMeta: string;
  fastTravelLabel?: string;
}

export const GAME_MENU_CONFIGS = {
  brawl: {
    slug: "brawl",
    topBar: "Cleared ground",
    titleKicker: "One-on-One Battlefield Duel",
    titleLines: [{ text: "BR" }, { text: "AWL", tone: "hot" }],
    titleSubtitle: "One champion, one rival. Settle the clash before the Scourge settles it for you.",
    titleStatus: ["Champion armed"],
    settingsKicker: "Duel Settings",
    codexKicker: "Cleared Ground",
    pauseKicker: "Cleared Ground",
    pauseSubtitle: "The clash holds. Steady your stance, then settle it.",
    backToWarlineLabel: "← Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  deadlane: {
    slug: "deadlane",
    topBar: "Ashgate lane",
    titleKicker: "Scourge Lane Defense",
    titleLines: [{ text: "DEAD" }, { text: "LANE", tone: "hot" }],
    titleSubtitle: "Hold the eastern lane. Build by hand. Keep the base breathing.",
    titleStatus: ["Run to the tile", "Build by hand", "Hold the base"],
    settingsKicker: "Wardens Console",
    codexKicker: "Ashgate Lane",
    pauseKicker: "Ashgate Lane",
    pauseSubtitle: "Re-enter the lane. The breach waits for no one.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  pactfall: {
    slug: "pactfall",
    topBar: "Broken concord",
    titleKicker: "Pyre vs Warden Arena",
    titleLines: [{ text: "PACT" }, { text: "FALL", tone: "hot" }],
    titleSubtitle: "Break the Warden base before the Scourge turns the duel into a feeding ground.",
    titleStatus: ["Champion armed", "Neutral Scourge buff"],
    settingsKicker: "Arena Settings",
    codexKicker: "Ashgate Arena",
    pauseKicker: "Ashgate Arena",
    pauseSubtitle: "The duel holds. Catch your breath, then redeploy.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  redline: {
    slug: "redline",
    topBar: "Beacon run",
    titleKicker: "Pyre Courier Run",
    titleLines: [{ text: "RED" }, { text: "LINE", tone: "hot" }],
    titleSubtitle:
      "Carry the cargo through the Scourge-rot lane to the BEACON. Beat the clock. Hold to build speed, jump the creep spikes, roll under the arches, ride the embers.",
    titleStatus: ["Courier ready"],
    settingsKicker: "Courier Settings",
    codexKicker: "Dead Road",
    pauseKicker: "Dead Road",
    pauseSubtitle: "The lane holds its breath. Catch yours.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  rothulk: {
    slug: "rothulk",
    topBar: "Pyre infiltration",
    titleKicker: "Pyre Infiltration",
    titleLines: [{ text: "ROT" }, { text: "HULK", tone: "hot" }],
    titleSubtitle: "Climb the living Scourge hulk. Ignite the breach-core. Escape the severed node.",
    titleStatus: ["Boarding spike armed", "Core at crown"],
    settingsKicker: "The Pyre // Console",
    codexKicker: "Pyre Infiltration",
    pauseKicker: "Pyre Infiltration",
    pauseSubtitle: "The hulk stirs while you hold. Resume the breach when ready.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  "scourge-survivors": {
    slug: "scourge-survivors",
    topBar: "Ashgate breach",
    titleKicker: "Pyre breach hub",
    titleLines: [{ text: "SCOURGE" }, { text: "SURVIVORS", tone: "hot" }],
    titleSubtitle: "Descend the breach. Burn the source nodes. Hold Ashgate.",
    titleStatus: ["Survivors core online"],
    settingsKicker: "Pyre Breach Settings",
    codexKicker: "Pyre Breach Hub",
    pauseKicker: "Pyre breach",
    pauseSubtitle: "The breach is held in stasis. Catch your breath, operator.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  starblight: {
    slug: "starblight",
    topBar: "Orbital front",
    titleKicker: "Orbital Survivors Front",
    titleLines: [{ text: "STAR" }, { text: "BLIGHT", tone: "hot" }],
    titleSubtitle: "THE ORBITAL FRONT",
    titleStatus: ["Interceptor online", "Draft systems hot"],
    settingsKicker: "Orbital Settings",
    codexKicker: "Orbital Front",
    pauseKicker: "Orbital Front",
    pauseSubtitle: "The Scourge holds at the threshold while you stand down.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
  },
  warline: {
    slug: "warline",
    topBar: "War for the lanes",
    titleKicker: "Strategic Command",
    titleLines: [{ text: "WAR" }, { text: "LINE", tone: "hot" }],
    titleSubtitle: "Walk the Front, step through a portal into any game, or take the Command Table to push the war.",
    titleStatus: ["Shared front online"],
    settingsKicker: "Audio Settings",
    codexKicker: "Warline Command",
    pauseKicker: "Warline Front",
    pauseSubtitle: "The lanes hold while you stand at the threshold.",
    backToWarlineLabel: "\u2190 Back to Warline",
    backToWarlineMeta: "Lobby",
    fastTravelLabel: "Portals - direct deploy",
  },
} satisfies Record<GameSlug, GameMenuConfig>;

export function gameMenuConfig(slug: GameSlug): GameMenuConfig {
  return GAME_MENU_CONFIGS[slug];
}

export function gameMenuTitleText(slug: GameSlug): string {
  return GAME_MENU_CONFIGS[slug].titleLines.map((line) => line.text).join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface GameMenuTitleHtmlOptions {
  id?: string;
  className?: string;
}

export function gameMenuTitleHtml(slug: GameSlug, options: GameMenuTitleHtmlOptions = {}): string {
  const config = gameMenuConfig(slug);
  const id = options.id ? ` id="${escapeHtml(options.id)}"` : "";
  const className = options.className ? ` ${escapeHtml(options.className)}` : "";
  const lines = config.titleLines
    .map(
      (line) =>
        `<span class="ssg-main-menu-title-line ssg-main-menu-title-line--${line.tone ?? "bone"}">${escapeHtml(
          line.text,
        )}</span>`,
    )
    .join("");
  return `<h1${id} class="ssg-main-menu-title${className}">${lines}</h1>`;
}

export interface GameMenuCopyHtmlOptions {
  kickerId?: string;
  titleId?: string;
  subtitleId?: string;
  subtitle?: string;
  status?: readonly string[];
}

export function gameMenuCopyHtml(slug: GameSlug, options: GameMenuCopyHtmlOptions = {}): string {
  const config = gameMenuConfig(slug);
  const kickerId = options.kickerId ? ` id="${escapeHtml(options.kickerId)}"` : "";
  const subtitleId = options.subtitleId ? ` id="${escapeHtml(options.subtitleId)}"` : "";
  const status = options.status ?? config.titleStatus;
  const statusHtml =
    status.length > 0
      ? `<div class="ssg-main-menu-status">${status.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
      : "";
  return `<div class="ssg-main-menu-copy">
        <div${kickerId} class="ssg-menu-kicker">${escapeHtml(config.titleKicker)}</div>
        ${gameMenuTitleHtml(slug, { id: options.titleId })}
        <p${subtitleId} class="ssg-main-menu-subtitle">${escapeHtml(options.subtitle ?? config.titleSubtitle)}</p>
        ${statusHtml}
      </div>`;
}
