// Warline is the lobby / main entry to every game (see the warline-is-lobby
// architecture). These helpers let any game send the player back to it.

const WARLINE_DEV_PORT = "5180";
// The per-game Vite dev ports (deadlane..starblight). When the page is served
// from one of these on localhost we're in the dev fleet and Warline is on 5180;
// otherwise (prod, or Warline itself) the hub serves it at /warline/.
const GAME_DEV_PORTS = new Set(["5174", "5175", "5176", "5177", "5178", "5179"]);

/**
 * Absolute URL of the Warline lobby:
 * - dev fleet (localhost on a game port) → `http://localhost:5180/`
 * - production / the hub → `/warline/`
 */
export function warlineLobbyHref(): string {
  if (typeof window === "undefined") return "/warline/";
  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocal && GAME_DEV_PORTS.has(port)) {
    return `${protocol}//${hostname}:${WARLINE_DEV_PORT}/`;
  }
  return "/warline/";
}

/** Navigate the browser back to the Warline lobby. */
export function goToWarlineLobby(): void {
  if (typeof window === "undefined") return;
  window.location.href = warlineLobbyHref();
}
