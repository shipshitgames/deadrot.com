// Data-only content for the public docs page. No JSX lives here; the sibling
// page.tsx is pure layout over these records.
import { BookOpen, type LucideIcon, RadioTower, Server, Swords } from "lucide-react";

export const contents = [
  { label: "Start", href: "#start" },
  { label: "Apps", href: "#apps" },
  { label: "Game State", href: "#games" },
  { label: "Packages", href: "#packages" },
  { label: "Lore", href: "#canon" },
  { label: "Workflow", href: "#workflow" },
];

export interface GameDocState {
  state: string;
  canonRole: string;
  warline: string;
}

const gameState = {
  "scourge-survivors": {
    state:
      "Flagship Pyre horde-survivors FPS. Public build is playable; canon frames it as the offensive breach-descent front.",
    canonRole:
      "A lone Purger goes where the Wardens can only hold the line: down into the breach, room by room, to burn source nodes.",
    warline: "Reports purge-breach operations: seal or weaken breaches and lower local Scourge pressure.",
  },
  deadlane: {
    state: "Warden 3D tower defense. Public build is playable; canon frames it as the defensive lane-holding front.",
    canonRole:
      "Each level is a named chokepoint where engineers, gunners, and wall-builders fragment the horde before it reaches holdouts.",
    warline: "Reports hold-lane operations: reduce lane flow, raise defenses, and keep regions from falling.",
  },
  pactfall: {
    state:
      "Playable prototype. Current build tests the arena/minion/neutral-Scourge loop first; the full PvP hero pillar is still the design target.",
    canonRole:
      "The Pyre and Wardens settle doctrine grudges in sanctioned arenas. The Pact bends, but it must not break.",
    warline: "Maps to contest-territory operations: arena victories help claim or stabilize contested ground.",
  },
  starblight: {
    state:
      "Playable orbital prototype. Zero Day is folded into it as the first-contact prologue; the main pillar is still momentum-flight pilot buildcraft.",
    canonRole:
      "Pilots burn Scourge spores, infected wreckage, and living carrier-ships out of orbit before they fall into the surface war. Its Zero Day mode shows the night that sky first fell.",
    warline: "Reports orbital-intercept operations: weaken active breaches from above and cut incoming infection.",
  },
  redline: {
    state:
      "Playable prototype. Current build focuses on a Pyre courier first; Warden courier expression remains part of the design target.",
    canonRole:
      "Speed beats omniscience: couriers outrun the Choir's prediction tempo to keep severed holdouts talking.",
    warline:
      "Reports run-logistics operations: move orders, fuel, scrap, and people through lanes the Scourge is trying to close.",
  },
  rothulk: {
    state:
      "Playable prototype. Current build tests the Pyre saboteur climb and breach-core ignition loop before the full enemy ecology is locked.",
    canonRole:
      "A saboteur climbs a beached Scourge breach-ship, reaches the breach-core, ignites it, and severs the local node.",
    warline: "Reports sabotage operations: damage breach hearts and make local Scourge clusters feral.",
  },
  warline: {
    state:
      "Playable prototype. The strategy-lite campaign layer: a living front, four resources, simple commands, and a game-to-operation loop.",
    canonRole:
      "The war console of the Resistance era: it tracks where the Pact is holding, where the Scourge pressures the lanes, and which operations buy the world more time.",
    warline:
      "IS the front. Every other game reports its operation here; commands spend the shared resources they earn.",
  },
} satisfies Record<string, GameDocState>;

/**
 * Safe slug lookup: returns undefined for catalog games that have no docs
 * entry yet, so callers must guard instead of crashing on a missing key.
 */
export const getGameDocState = (slug: string): GameDocState | undefined =>
  (gameState as Record<string, GameDocState>)[slug];

export const principles = [
  "Canon lives in apps/lore/content. This site reflects it; it does not replace it.",
  "The Scourge are parasites and host-takeover organisms, never generic monsters.",
  "Toxic green belongs to Scourge infection, breach cores, and parasite nodes.",
  "React owns shells and HUDs. Gameplay loops stay imperative and Three.js-centered.",
  "Bun and Turbo are the default workspace tools.",
];

export const scourgeFacts = [
  "Host-dependent parasite with no native form. It wears flesh, machines, ships, fungus, and dead-world biology.",
  "Not evil in the moral sense. It is an AI-like survival optimizer with no off-switch and no mercy.",
  "The Choir is the connection, not a single boss. There is no general to assassinate.",
  "The Choir has limited radius. Repeaters and dense swarm mass extend it; sever them and the local horde goes feral.",
  "Humanity wins locally through isolation and starvation. You buy the world time; you do not erase the whole Scourge.",
];

export const hostFamilies = [
  "Rot-infested flesh hosts",
  "Chitin warhosts",
  "Mycelial spore hosts",
  "Machine-graft hosts",
  "Bone titan hosts",
  "Voidship hosts",
];

export const appSurfaces: {
  icon: LucideIcon;
  path: string;
  title: string;
  href?: string;
  description: string;
}[] = [
  {
    icon: Server,
    path: "apps/api",
    title: "Player API",
    description: "The Bun/Postgres API for player-facing Deadrot services.",
  },
  {
    icon: BookOpen,
    path: "apps/web",
    title: "Public Site And Docs",
    href: "/",
    description:
      "The deadrot.com surface: studio home, game gallery, universe pages, bestiary, characters, and this public docs route.",
  },
  {
    icon: BookOpen,
    path: "apps/lore",
    title: "Lore Vault",
    href: "https://lore.deadrot.com",
    description: "The Quartz application and Obsidian-rooted canon vault at apps/lore/content.",
  },
  {
    icon: Swords,
    path: "apps/games/{scourge-survivors,deadlane,pactfall,brawl,starblight,redline,rothulk}",
    title: "Seven Playable Fronts",
    description:
      "The game fleet: seven playable fronts, including Brawl, that report their operations into the shared war.",
  },
  {
    icon: RadioTower,
    path: "apps/games/warline",
    title: "Warline",
    href: "/warline/",
    description: "The persistent War for the Lanes operation front that receives cross-game operation reports.",
  },
];

export const packages = [
  {
    name: "@deadrot/catalog",
    path: "packages/catalog",
    description:
      "Single source of truth for the game roster, routes, ports, deployment records, and seven-fronts-plus-Warline architecture.",
  },
  {
    name: "@deadrot/game-kit",
    path: "packages/game-kit",
    description:
      "Shared Deadrot game runtime: audio, VFX/juice, core utilities, codex mapping, and cross-game war records.",
  },
  {
    name: "@shipshitgames/ui",
    path: "packages/ui",
    description:
      "Shared React components and CSS-first game UI classes for menus, HUD corners, buttons, and upgrade cards.",
  },
  {
    name: "@shipshitgames/assets",
    path: "packages/assets",
    description: "Canon asset catalog, entity matrix, shared FX/UI/audio/font records, and typed asset resolvers.",
  },
  {
    name: "@shipshitgames/warline",
    path: "packages/warline",
    description: "Pure world-state model, reducers, commands, operation contract, summary helpers, and client SDK.",
  },
];

export const commands = [
  {
    title: "Install And Build",
    lines: ["bun install", "bun run build", "bun run typecheck"],
  },
  {
    title: "Package Checks",
    lines: [
      "cd packages/ui && bun run typecheck",
      "cd packages/game-kit && bun run test:unit",
      "cd packages/warline && bun run test",
      "cd packages/catalog && bun run test",
    ],
  },
  {
    title: "Asset Custody",
    lines: ["bun run --cwd packages/assets assets:check", "bun run --cwd packages/assets assets:index:check"],
  },
  {
    title: "Repository Catalog",
    lines: ["bun run docs:catalog", "bun run docs:catalog:check"],
  },
];

export const nextDocs = [
  "Split this page into /docs/games, /docs/catalog, /docs/assets, and /docs/warline when the material gets deeper.",
  "Promote package README content into public docs while keeping code-level API details close to each package.",
  "Add contribution docs once the open-core repo, game repos, and lore repo policies settle.",
];
