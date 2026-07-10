import {
  createPartySocketFactory,
  createPresenceRegistry,
  createTransport,
  type NetTransport,
  type PeerFactory,
  type PresenceHooks,
  type PresenceRegistry,
  type RemotePeer,
  type SocketFactory,
} from "@deadrot/game-kit/net";

/**
 * FPS PvP arena-preview networking schema + wiring. The generic transport/presence
 * primitives live in `@deadrot/game-kit/net`; this module owns the
 * Scourge-specific message shapes (`t: 'state' | 'name' | 'hit'`) and the
 * factories that bind them to the room. The PartyKit server (`party/arena.ts`)
 * speaks this same schema and validates the preview's accepted movement/damage claims.
 */

/** Per-frame transform + loadout a peer broadcasts. The payload for `t:'state'`. */
export interface FpsPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  weapon: string;
  health: number;
}

/** Welcome/join payload describing a player already in the room. */
export interface RemotePlayerInfo extends FpsPose {
  id: string;
  name: string;
  avatar: string;
  slot: number;
  kills: number;
}

/** Server-authored hit/kill resolution broadcast to the room (`t:'hit'`). */
export interface HitMessage {
  target: string;
  by: string;
  byName: string;
  health: number;
  killed: boolean;
  killerKills: number;
  respawn: { x: number; y: number; z: number } | null;
}

/** A remote player object the presence registry owns (RemoteAvatar implements this). */
export type FpsPeer = RemotePeer;

/** Presence registry specialised to FPS room peers. */
export type FpsPresence<P extends FpsPeer> = PresenceRegistry<RemotePlayerInfo, P>;

/** Default PartyKit host: local `partykit dev` in dev, env-configured in prod. */
const PARTYKIT_HOST: string =
  (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) || (import.meta.env.DEV ? "localhost:1999" : "");

/**
 * Dev-only test seam: an injected socket factory replaces PartySocket so an e2e
 * can run a loopback room entirely in-browser without a live PartyKit server.
 * Guarded by `import.meta.env.DEV`, so production builds never read it.
 */
interface SocketFactoryGlobal {
  __fpsSocketFactory?: SocketFactory;
}

function resolveSocketFactory(host: string): SocketFactory {
  if (import.meta.env.DEV) {
    const injected = (globalThis as SocketFactoryGlobal).__fpsSocketFactory;
    if (injected) return injected;
  }
  return createPartySocketFactory({ host, party: "main" });
}

/** Build the FPS PvP transport (PartySocket-backed, or a dev-injected loopback). */
export function createFpsTransport(host: string = PARTYKIT_HOST): NetTransport {
  return createTransport({ socketFactory: resolveSocketFactory(host) });
}

/** Build the FPS presence registry from a peer factory + scene-wiring hooks. */
export function createFpsPresence<P extends FpsPeer>(
  factory: PeerFactory<RemotePlayerInfo, P>,
  hooks?: PresenceHooks<P>,
): FpsPresence<P> {
  return createPresenceRegistry<RemotePlayerInfo, P>(factory, hooks);
}
