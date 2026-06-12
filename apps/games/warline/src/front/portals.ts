import { GAME_APPS, gameRoute } from "@deadrot/catalog";
import greenGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-gate.webp";
import greenLiftSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-lift.webp";
import mawSpireSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/maw-spire.webp";
import orangePortalSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/orange-portal.webp";
import redAltarSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/red-altar.webp";
import wallGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/wall-gate.webp";
import { gameHref, isDevFleetPage } from "@shipshitgames/ui";
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

// The Front-specific facts for each portal bay: where it stands in the 3D
// lobby and how it looks. Title, route, dev port, and accent come from
// @deadrot/catalog (the roster SSOT) so the portals can never drift from the
// title-menu quick links.
interface PortalSiteDef {
  slug: GameSlug;
  regionId: string;
  bay: string;
  position: [number, number];
  spriteUrl: string;
  spriteScale: [number, number];
  spriteY: number;
}

const PORTAL_SITES: PortalSiteDef[] = [
  {
    slug: "scourge-survivors",
    regionId: "maw",
    bay: "Breach Drop",
    position: [-27, -25],
    spriteUrl: orangePortalSpriteUrl,
    spriteScale: [5.4, 6.45],
    spriteY: 2.65,
  },
  {
    slug: "deadlane",
    regionId: "hollowlanes",
    bay: "Lane Hold",
    position: [0, -33],
    spriteUrl: wallGateSpriteUrl,
    spriteScale: [5.2, 5.2],
    spriteY: 2.55,
  },
  {
    slug: "pactfall",
    regionId: "rustmarch",
    bay: "Arena Gate",
    position: [28, -22],
    spriteUrl: greenGateSpriteUrl,
    spriteScale: [5.5, 5.95],
    spriteY: 2.55,
  },
  {
    slug: "starblight",
    regionId: "skyhook",
    bay: "Orbital Lift",
    position: [31, 18],
    spriteUrl: greenLiftSpriteUrl,
    spriteScale: [4.9, 6.75],
    spriteY: 2.65,
  },
  {
    slug: "redline",
    regionId: "ashgate",
    bay: "Courier Exit",
    position: [0, 33],
    spriteUrl: redAltarSpriteUrl,
    spriteScale: [5.8, 5.8],
    spriteY: 2.7,
  },
  {
    slug: "rothulk",
    regionId: "cinder",
    bay: "Hulk Descent",
    position: [-30, 18],
    spriteUrl: mawSpireSpriteUrl,
    spriteScale: [5.35, 6.2],
    spriteY: 2.7,
  },
];

export const PORTALS: PortalDef[] = PORTAL_SITES.map((site) => {
  const app = GAME_APPS.find((game) => game.slug === site.slug);
  if (!app) throw new Error(`No @deadrot/catalog entry for portal game "${site.slug}"`);
  return {
    ...site,
    title: app.title,
    href: gameRoute(site.slug),
    devPort: app.devPort,
    accentCss: app.accent,
  };
});

export function resolvePortalHref(portal: PortalDef): string {
  return gameHref(portal.slug);
}

export function shouldUseLocalGamePort(): boolean {
  return isDevFleetPage();
}

export function normalizePath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}
