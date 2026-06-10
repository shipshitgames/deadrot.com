import greenGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-gate.webp";
import greenLiftSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-lift.webp";
import mawSpireSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/maw-spire.webp";
import orangePortalSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/orange-portal.webp";
import redAltarSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/red-altar.webp";
import wallGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/wall-gate.webp";
import type { GameSlug } from "@shipshitgames/warline";

export interface PortalDef {
  slug: GameSlug;
  title: string;
  href: string;
  devPort: number;
  regionId: string;
  bay: string;
  position: [number, number];
  accentCss: string;
  spriteUrl: string;
  spriteScale: [number, number];
  spriteY: number;
}

export const PORTALS: PortalDef[] = [
  {
    slug: "scourge-survivors",
    title: "Scourge Survivors",
    href: "/scourge-survivors/",
    devPort: 5178,
    regionId: "maw",
    bay: "Breach Drop",
    position: [-27, -25],
    accentCss: "#ff6a00",
    spriteUrl: orangePortalSpriteUrl,
    spriteScale: [5.4, 6.45],
    spriteY: 2.65,
  },
  {
    slug: "deadlane",
    title: "Deadlane",
    href: "/deadlane/",
    devPort: 5174,
    regionId: "hollowlanes",
    bay: "Lane Hold",
    position: [0, -33],
    accentCss: "#c1121f",
    spriteUrl: wallGateSpriteUrl,
    spriteScale: [5.2, 5.2],
    spriteY: 2.55,
  },
  {
    slug: "pactfall",
    title: "Pactfall",
    href: "/pactfall/",
    devPort: 5175,
    regionId: "rustmarch",
    bay: "Arena Gate",
    position: [28, -22],
    accentCss: "#e9e3d6",
    spriteUrl: greenGateSpriteUrl,
    spriteScale: [5.5, 5.95],
    spriteY: 2.55,
  },
  {
    slug: "starblight",
    title: "Starblight",
    href: "/starblight/",
    devPort: 5179,
    regionId: "skyhook",
    bay: "Orbital Lift",
    position: [31, 18],
    accentCss: "#8bdc1f",
    spriteUrl: greenLiftSpriteUrl,
    spriteScale: [4.9, 6.75],
    spriteY: 2.65,
  },
  {
    slug: "redline",
    title: "Redline",
    href: "/redline/",
    devPort: 5176,
    regionId: "ashgate",
    bay: "Courier Exit",
    position: [0, 33],
    accentCss: "#ff2a18",
    spriteUrl: redAltarSpriteUrl,
    spriteScale: [5.8, 5.8],
    spriteY: 2.7,
  },
  {
    slug: "rothulk",
    title: "Rothulk",
    href: "/rothulk/",
    devPort: 5177,
    regionId: "cinder",
    bay: "Hulk Descent",
    position: [-30, 18],
    accentCss: "#cdbfae",
    spriteUrl: mawSpireSpriteUrl,
    spriteScale: [5.35, 6.2],
    spriteY: 2.7,
  },
];

export function resolvePortalHref(portal: PortalDef): string {
  if (shouldUseLocalGamePort()) {
    return `${window.location.protocol}//${window.location.hostname}:${portal.devPort}/`;
  }
  return portal.href;
}

export function shouldUseLocalGamePort(): boolean {
  const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  return import.meta.env.DEV && isLocalHost;
}

export function normalizePath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}
