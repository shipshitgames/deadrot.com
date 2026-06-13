// @deadrot/catalog — the single source of truth for the Deadrot game roster.
//
// Framework-agnostic plain ESM (no build step) so the SAME data can be imported by:
//   - apps/web/next.config.mjs        (Node, at config load — cannot transpile TS)
//   - e2e/game-catalog.ts             (Bun test harness + Playwright fan-out)
//   - packages/ui/src/lobby.ts        (browser — Warline lobby routing)
//   - apps/web/lib/content/index.ts   (Next hub content/status layer)
//
// Per-game runtime facts (dev port, prod deploy URL, hub route, status) live
// HERE and only here. Each game's vite.config.ts `server.port` is asserted
// against `devPort` by e2e/game-catalog.test.ts so the two can never silently
// drift. Types live in the sibling index.d.ts.

// `title` + `accent` drive cross-game UI: the Warline 3D portal labels and the
// quick-jump strips on every game's title menu (packages/ui GameJumpMenu).
// Titles are mirrored from the lore canon (packages/assets/lore/games.json);
// e2e/game-catalog.test.ts asserts the two stay in sync. Accents are the
// cross-game UI palette, intentionally separate from the lore accent tokens.

// Playable game apps, ordered by ascending dev port. The e2e harness pins this
// order (deadlane 5174 → brawl 5181), so keep new apps inserted by port.
export const GAME_APPS = [
  {
    slug: "deadlane",
    title: "Deadlane",
    accent: "#c1121f",
    devPort: 5174,
    deployUrl: "https://deadlane-one.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "pactfall",
    title: "Pactfall",
    accent: "#e9e3d6",
    devPort: 5175,
    deployUrl: "https://pactfall.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "redline",
    title: "Redline",
    accent: "#ff2a18",
    devPort: 5176,
    deployUrl: "https://redline-eight-theta.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "rothulk",
    title: "Rothulk",
    accent: "#cdbfae",
    devPort: 5177,
    deployUrl: "https://rothulk.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "scourge-survivors",
    title: "Scourge Survivors",
    accent: "#ff6a00",
    devPort: 5178,
    deployUrl: "https://scourge-survivors.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "starblight",
    title: "Starblight",
    accent: "#8bdc1f",
    devPort: 5179,
    deployUrl: "https://starblight.vercel.app",
    status: "PLAYABLE",
  },
  // Warline is the persistent lobby / front door (EPIC #34), a Vite SPA backed by
  // the PartyKit server at warline.vincentshipsit.partykit.dev.
  {
    slug: "warline",
    title: "Warline",
    accent: "#ff6a00",
    devPort: 5180,
    deployUrl: "https://warline-jet.vercel.app",
    status: "PLAYABLE",
  },
  {
    slug: "brawl",
    title: "Brawl",
    accent: "#c1121f",
    devPort: 5181,
    deployUrl: "https://brawl.vercel.app",
    status: "PLAYABLE",
  },
];

// Titles that exist in canon/marketing but have no in-repo app (and so no port,
// deploy, or playable route) yet.
export const CONCEPTS = [];

// Slug of the lobby / front-door game that the in-game "back to lobby" routing targets.
export const LOBBY_SLUG = "warline";

// Same-origin hub path a game is served under on deadrot.com.
export const gameRoute = (slug) => `/${slug}/`;

// slug -> prod deploy URL (drives the next.config production rewrite-proxy).
export const gameDeploys = Object.fromEntries(GAME_APPS.map((g) => [g.slug, g.deployUrl]));

// slug -> local Vite dev port (drives the next.config dev redirect to the dev fleet).
export const gameDevPorts = Object.fromEntries(GAME_APPS.map((g) => [g.slug, g.devPort]));

// Ordered app slugs.
export const gameSlugs = GAME_APPS.map((g) => g.slug);

// The playable front games (everything except the warline lobby), in the
// canonical Scourge-universe order shared by @shipshitgames/assets and
// @shipshitgames/warline. NOT the dev-port order of GAME_APPS above.
export const PLAYABLE_GAME_SLUGS = [
  "scourge-survivors",
  "deadlane",
  "pactfall",
  "brawl",
  "starblight",
  "redline",
  "rothulk",
];
