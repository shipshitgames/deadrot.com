/**
 * Genre-neutral registry of remote peers in a room. The transport owns the
 * wire; this owns "who is here". A game supplies a {@link PeerFactory} that
 * turns a join payload into its own peer object (an avatar, a cursor, a ship)
 * plus optional {@link PresenceHooks} to wire that object into the world. The
 * registry enforces the rules every networked game re-implements — never add
 * yourself, never add a peer twice, dispose on removal — so each game does not.
 */

/** The minimum a game's remote-peer object must expose to live in the registry. */
export interface RemotePeer {
  readonly id: string;
  /** Release any resources (meshes, textures, listeners) the peer holds. */
  dispose(): void;
}

/** Any join/welcome payload carrying at least a stable peer id. */
export interface PeerInfo {
  id: string;
}

/** Builds a game-specific peer object from its join payload. */
export type PeerFactory<I extends PeerInfo, P extends RemotePeer> = (info: I) => P;

export interface PresenceHooks<P extends RemotePeer> {
  /** Runs right after a peer is added — e.g. add its group to the scene. */
  onAdd?: (peer: P) => void;
  /** Runs right before a peer is disposed — e.g. remove it from the scene. */
  onRemove?: (peer: P) => void;
}

export interface PresenceRegistry<I extends PeerInfo, P extends RemotePeer> {
  /** This client's own id; a peer whose id matches is never added. */
  selfId: string;
  /** Number of tracked remote peers. */
  readonly size: number;
  has(id: string): boolean;
  get(id: string): P | undefined;
  /** Live iterator over tracked peers, in insertion order. */
  values(): IterableIterator<P>;
  /**
   * Add a peer from its join payload. Skips and returns `null` when the id is
   * {@link selfId} or already present; otherwise builds the peer, runs
   * {@link PresenceHooks.onAdd}, and returns it.
   */
  add(info: I): P | null;
  /**
   * Remove and dispose a peer (running {@link PresenceHooks.onRemove} first).
   * Returns the removed peer, or `undefined` if no peer had that id.
   */
  remove(id: string): P | undefined;
  /** Remove and dispose every tracked peer. */
  clear(): void;
}

/** Create a {@link PresenceRegistry} for peers built by `factory`. */
export function createPresenceRegistry<I extends PeerInfo, P extends RemotePeer>(
  factory: PeerFactory<I, P>,
  hooks: PresenceHooks<P> = {},
): PresenceRegistry<I, P> {
  const peers = new Map<string, P>();
  let selfId = "";

  function destroy(peer: P): void {
    hooks.onRemove?.(peer);
    peer.dispose();
  }

  return {
    get selfId() {
      return selfId;
    },
    set selfId(id: string) {
      selfId = id;
    },
    get size() {
      return peers.size;
    },
    has(id) {
      return peers.has(id);
    },
    get(id) {
      return peers.get(id);
    },
    values() {
      return peers.values();
    },
    add(info) {
      if (info.id === selfId || peers.has(info.id)) return null;
      const peer = factory(info);
      peers.set(info.id, peer);
      hooks.onAdd?.(peer);
      return peer;
    },
    remove(id) {
      const peer = peers.get(id);
      if (!peer) return undefined;
      peers.delete(id);
      destroy(peer);
      return peer;
    },
    clear() {
      for (const peer of peers.values()) destroy(peer);
      peers.clear();
    },
  };
}
