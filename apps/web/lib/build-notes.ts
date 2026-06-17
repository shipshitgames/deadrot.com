export interface ValidationEvidence {
  command: string;
  result: string;
}

export interface BuildNote {
  slug: string;
  date: string;
  title: string;
  summary: string;
  highlights: string[];
  gameUpdates: string[];
  warlineAndMeta: string[];
  assetsAndAudio: string[];
  mobileAndAccessibility: string[];
  validation: ValidationEvidence[];
}

export const buildNotes: BuildNote[] = [
  {
    slug: "2026-06-17-shippability-pack",
    date: "2026-06-17",
    title: "Shippability Pack",
    summary:
      "A milestone build focused on making Deadrot easier to inspect, prove, and explain: playable proof tours, runtime asset budgets, a public Codex, and local contributor surfaces.",
    highlights: [
      "Added a repeatable playable proof-tour command that captures screenshots and nonblank checks for every shipped game.",
      "Added per-game runtime asset budgets so source history stays preserved without being mistaken for player payload.",
      "Published the native Deadrot Codex from the lore derivative, roster catalog, and package asset data.",
      "Started local build-note publishing so release work has a stable player-facing history.",
    ],
    gameUpdates: [
      "Proof-tour recipes cover Scourge Survivors, Deadlane, Pactfall, Redline, Rothulk, Starblight, Brawl, and Warline.",
      "Each recipe records a ready state, page errors, screenshot artifacts, and a canvas or page nonblank probe.",
      "The public Codex links every game to its faction, operators, enemies, locations, and timeline context.",
    ],
    warlineAndMeta: [
      "Warline is treated as the hub/meta build category in asset budgets, separate from small arcade games and 3D arena packs.",
      "Game-kit now exports stable public Codex anchors so games can deep-link from menus, overlays, or post-run summaries.",
    ],
    assetsAndAudio: [
      "Scourge Survivors currently reports 21.41 MiB of runtime assets after source/draft custody folders are excluded.",
      "Warline currently reports 7.91 MiB of runtime assets, led by the portal-deck atlas and local music loop.",
      "The budget gate keeps the existing WebP runtime policy and the documented `ui/social/og.jpg` exception intact.",
    ],
    mobileAndAccessibility: [
      "The Codex route has focused desktop and mobile Playwright coverage.",
      "Build-note pages use normal links and headings so they remain navigable from the site footer and community surface.",
    ],
    validation: [
      {
        command: "bun run proof:tours",
        result: "Passed for all eight shipped game apps; report written to .artifacts/proof-tours/report.md.",
      },
      {
        command: "bun run assets:check",
        result: "Passed with runtime budget checks wired into the root asset gate.",
      },
      {
        command: "bun run codex:check",
        result: "Passed lore drift, game-kit Codex helper, and public Codex data tests.",
      },
      {
        command: "bunx playwright test -c apps/web/playwright.config.ts codex.spec.ts",
        result: "Passed on web:desktop and web:mobile.",
      },
    ],
  },
];

export const latestBuildNote = buildNotes[0];

export function getBuildNote(slug: string): BuildNote | undefined {
  return buildNotes.find((note) => note.slug === slug);
}
