// Warline is the lobby / main entry to every game (see the warline-is-lobby
// architecture). These helpers let any game send the player back to it — or,
// via gameHref/gameJumpTargets, jump straight into another game without
// walking the Front.

import { GAME_APPS, type GameSlug, gameRoute, LOBBY_SLUG, PLAYABLE_GAME_SLUGS } from "@deadrot/catalog";

// Roster facts come from the single source of truth in @deadrot/catalog.
const GAME_BY_SLUG = new Map(GAME_APPS.map((game) => [game.slug, game]));
// All fleet Vite dev ports. When the page is served from one of these on
// localhost we're in the dev fleet, so cross-game links target sibling ports;
// otherwise (prod, vite preview, the hub) they use same-origin hub routes
// like /deadlane/.
const FLEET_DEV_PORTS = new Set(GAME_APPS.map((game) => String(game.devPort)));

/** True when the page is served from one of the fleet dev ports on localhost. */
export function isDevFleetPage(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocal && FLEET_DEV_PORTS.has(port);
}

/**
 * Absolute URL of a game:
 * - dev fleet (localhost on a fleet port) → `http://localhost:<devPort>/`
 * - production / the hub → `/<slug>/`
 */
export function gameHref(slug: GameSlug): string {
  if (isDevFleetPage()) {
    const devPort = GAME_BY_SLUG.get(slug)?.devPort;
    if (devPort) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:${devPort}/`;
    }
  }
  return gameRoute(slug);
}

/** Absolute URL of the Warline lobby. */
export function warlineLobbyHref(): string {
  return gameHref(LOBBY_SLUG);
}

/** Navigate the browser back to the Warline lobby. */
export function goToWarlineLobby(): void {
  if (typeof window === "undefined") return;
  window.location.href = warlineLobbyHref();
}

export interface GameJumpTarget {
  slug: GameSlug;
  title: string;
  href: string;
  accent: string;
}

/**
 * The playable front games as quick-jump links, in the canonical
 * Scourge-universe order, excluding `currentSlug`. Warline itself is excluded:
 * game menus give the lobby its own dedicated "Back to Warline" action.
 */
export function gameJumpTargets(currentSlug?: GameSlug): GameJumpTarget[] {
  return PLAYABLE_GAME_SLUGS.filter((slug) => slug !== currentSlug).flatMap((slug) => {
    const game = GAME_BY_SLUG.get(slug);
    if (game?.status !== "PLAYABLE") return [];
    return [{ slug: game.slug, title: game.title, href: gameHref(game.slug), accent: game.accent }];
  });
}

export const GAME_JUMP_DEFAULT_LABEL = "Fast travel";

/**
 * The quick-jump strip as an HTML string, for imperative (non-React) menus.
 * Must stay markup-identical to the GameJumpMenu component in GameJump.tsx —
 * both live in this package, next to the .ssg-game-jump styles.
 * Titles/accents/hrefs are trusted catalog constants, so no escaping.
 */
export function gameJumpHtml(currentSlug?: GameSlug, label: string = GAME_JUMP_DEFAULT_LABEL): string {
  const targets = gameJumpTargets(currentSlug);
  if (targets.length === 0) return "";
  const links = targets
    .map(
      (t) =>
        `<a class="ssg-game-jump__link" style="--ssg-game-jump-accent: ${t.accent}" href="${t.href}">${t.title}</a>`,
    )
    .join("");
  return `<div class="ssg-game-jump">
          <span class="ssg-game-jump__label">${label}</span>
          <span class="ssg-game-jump__links">${links}</span>
        </div>`;
}
