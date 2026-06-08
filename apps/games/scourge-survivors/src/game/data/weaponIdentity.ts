import type { WeaponId } from "../constants";
import type { SurvivorClassId } from "./survivors";

export type WeaponIdentityPhaseStatus = "implemented";

export interface WeaponIdentityPhase {
  id: string;
  sourceIssue: string;
  title: string;
  status: WeaponIdentityPhaseStatus;
  evidence: string;
}

export interface WeaponIdentityDef {
  id: WeaponId;
  displayName: string;
  callsign: string;
  role: string;
  fantasy: string;
  starterClassIds: SurvivorClassId[];
  assetIds: {
    sprite: string;
    sfx: string;
  };
  ads: {
    label: string;
    zoomLevels: number;
    scoped: boolean;
  };
  dualCompatible: boolean;
  issuePhaseIds: string[];
}

export const WEAPON_IDENTITY_TRACKER = {
  issue: 112,
  sourceIssue: "shipshitgames/scourge-survivors#71",
  project: "deadrot.com/scourge-survivors",
  canonDocs: [
    "apps/lore/content/CANON.md",
    "apps/lore/content/00-Index.md",
    "apps/lore/content/README.md",
    "apps/lore/content/DESIGN.md",
    "apps/lore/content/Universe/Style-Bible.md",
    "apps/lore/content/Universe/Survivors-Loop.md",
    "apps/lore/content/Games/Scourge-Survivors.md",
  ],
  decisions: [
    "The Pyre sidearm is the default/base weapon.",
    "The old rifle direction is preserved as sniper/marksman identity, not default weapon identity.",
    "Each selectable Scourge Survivors class starts with a different weapon.",
    "Dual weapon is an in-run pickup bonus, not a fixed dual-pistol evolution.",
  ],
} as const;

export const WEAPON_IDENTITY_PHASES: WeaponIdentityPhase[] = [
  {
    id: "class-starting-weapons",
    sourceIssue: "shipshitgames/scourge-survivors#64",
    title: "Character starting weapon data model",
    status: "implemented",
    evidence: "SURVIVOR_CLASSES binds a unique startingWeapon to each selectable Pyre avatar.",
  },
  {
    id: "pistol-sidearm-default",
    sourceIssue: "shipshitgames/scourge-survivors#68",
    title: "Pyre pistol sidearm default weapon and asset",
    status: "implemented",
    evidence: "STARTING_WEAPON is pistol and the runtime manifest ships weapon-pistol plus sfx-pistol-pyre.",
  },
  {
    id: "scoped-sniper-ads",
    sourceIssue: "shipshitgames/scourge-survivors#65",
    title: "Scoped sniper gameplay and per-weapon ADS",
    status: "implemented",
    evidence: "Weapon specs carry per-weapon adsFovs; sniper has two zoom levels and a marksman headshot payoff.",
  },
  {
    id: "dual-pickup-bonus",
    sourceIssue: "shipshitgames/scourge-survivors#66",
    title: "Dual-weapon pickup bonus",
    status: "implemented",
    evidence: "The pickup-dual runtime bonus mirrors compatible weapons temporarily and leaves cannon single-rigged.",
  },
  {
    id: "hud-sandbox-tests",
    sourceIssue: "shipshitgames/scourge-survivors#69",
    title: "HUD, sandbox, tests, and browser verification",
    status: "implemented",
    evidence: "HUD state exposes weapon identity, sandbox can fire every gun, and tests guard the identity contract.",
  },
  {
    id: "pyre-weapon-era-sprites",
    sourceIssue: "shipshitgames/scourge-survivors#67",
    title: "Restyle selectable character sprites to Pyre weapon era",
    status: "implemented",
    evidence: "Runtime character assets are sourced from packages/assets/games/scourge-survivors/players/pyre/*.",
  },
  {
    id: "first-balance-pass",
    sourceIssue: "shipshitgames/scourge-survivors#70",
    title: "First balance pass for pistol, sniper, ADS, and dual pickup",
    status: "implemented",
    evidence:
      "Weapon specs define distinct fire cadence, magazine, spread, ADS, headshot, dual, recoil, and ammo tuning.",
  },
];

export const WEAPON_IDENTITIES: Record<WeaponId, WeaponIdentityDef> = {
  pistol: {
    id: "pistol",
    displayName: "Pistol",
    callsign: "Pyre Sidearm",
    role: "Default sidearm",
    fantasy: "Reliable breach pistol for Ranger starts and fallback Pyre gunplay.",
    starterClassIds: ["ranger"],
    assetIds: {
      sprite: "weapon-pistol",
      sfx: "sfx-pistol-pyre",
    },
    ads: {
      label: "single ADS notch",
      zoomLevels: 1,
      scoped: false,
    },
    dualCompatible: true,
    issuePhaseIds: ["class-starting-weapons", "pistol-sidearm-default", "first-balance-pass"],
  },
  smg: {
    id: "smg",
    displayName: "SMG",
    callsign: "Vector SMG",
    role: "Mobility spray",
    fantasy: "Compact breach-marker weapon for Vector's fast looter and crit-skirmisher identity.",
    starterClassIds: ["scout"],
    assetIds: {
      sprite: "weapon-smg",
      sfx: "sfx-smg-pyre",
    },
    ads: {
      label: "close ADS notch",
      zoomLevels: 1,
      scoped: false,
    },
    dualCompatible: true,
    issuePhaseIds: ["class-starting-weapons", "first-balance-pass"],
  },
  shotgun: {
    id: "shotgun",
    displayName: "Shotgun",
    callsign: "Bulwark Shotgun",
    role: "Close breach control",
    fantasy: "Heavy Pyre door-breaker for Bulwark's slow, durable breach-anchor role.",
    starterClassIds: ["heavy"],
    assetIds: {
      sprite: "weapon-shotgun",
      sfx: "sfx-shotgun",
    },
    ads: {
      label: "wide ADS notch",
      zoomLevels: 1,
      scoped: false,
    },
    dualCompatible: true,
    issuePhaseIds: ["class-starting-weapons", "first-balance-pass"],
  },
  cannon: {
    id: "cannon",
    displayName: "Cannon",
    callsign: "Cannon V02",
    role: "Power pickup",
    fantasy: "Preserved heavy cannon direction: explosive, loud, scarce, and deliberately single-rigged.",
    starterClassIds: [],
    assetIds: {
      sprite: "weapon-cannon",
      sfx: "sfx-cannon",
    },
    ads: {
      label: "brace ADS notch",
      zoomLevels: 1,
      scoped: false,
    },
    dualCompatible: false,
    issuePhaseIds: ["dual-pickup-bonus", "first-balance-pass"],
  },
  sniper: {
    id: "sniper",
    displayName: "Sniper",
    callsign: "Patch Marksman",
    role: "Scoped marksman",
    fantasy: "The old long-rifle direction, now promoted into Patch's scoped precision identity.",
    starterClassIds: ["medic"],
    assetIds: {
      sprite: "weapon-sniper",
      sfx: "sfx-sniper",
    },
    ads: {
      label: "two-stage scope",
      zoomLevels: 2,
      scoped: true,
    },
    dualCompatible: true,
    issuePhaseIds: ["class-starting-weapons", "scoped-sniper-ads", "first-balance-pass"],
  },
};

export function weaponIdentityFor(id: WeaponId): WeaponIdentityDef {
  return WEAPON_IDENTITIES[id];
}
