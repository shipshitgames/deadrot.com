// Issue #94 — Extract transport and presence.
//
// End-to-end proof of the extracted net stack: two real `createTransport` +
// `createPresenceRegistry` clients (from `@deadrot/game-kit/net`) talk through an
// in-memory hub that mirrors the wire protocol of `party/arena.ts` (the real
// PartyKit server, intentionally left untouched). This is the headless stand-in
// for "playtest a 2-client PvP preview": join, presence, accepted state sync, server-owned
// hit/kill resolution, and leave — all without a browser or a live PartyKit dev
// server.
import {
  createPresenceRegistry,
  createTransport,
  type NetTransport,
  type PresenceRegistry,
  type RemotePeer,
  type TransportSocket,
} from "@deadrot/game-kit/net";
import { describe, expect, it } from "vitest";
import {
  ARENA_POLICY,
  acceptCadence,
  acceptClientPose,
  acceptDamageClaim,
  acceptWeaponName,
  normalizeAvatarId,
  sanitizePlayerName,
} from "../../party/arenaPolicy";
import type { HitMessage, RemotePlayerInfo } from "../../src/net/fpsNet";

// --- In-memory PartyKit Arena, faithful to party/arena.ts broadcast semantics ---

interface PlayerState {
  id: string;
  name: string;
  avatar: string;
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  weapon: string;
  health: number;
  kills: number;
  alive: boolean;
  joined: boolean;
  acceptedAt: number;
  stateFrames: number[];
  hitFrames: number[];
}

/** A loopback socket the transport drives; routes sends into the hub. */
class HubSocket implements TransportSocket {
  readyState = 1; // OPEN — the hub is always ready to receive
  opened = false;
  private openListeners: Array<() => void> = [];
  private closeListeners: Array<() => void> = [];
  private messageListeners: Array<(event: { data: string }) => void> = [];

  constructor(
    readonly id: string,
    private hub: ArenaHub,
  ) {}

  send(data: string) {
    this.hub.receive(this.id, data);
  }
  close() {
    this.hub.handleClose(this.id);
    for (const l of this.closeListeners) l();
  }
  addEventListener(type: "open" | "close" | "message", listener: (event?: { data: string }) => void) {
    if (type === "open") this.openListeners.push(listener as () => void);
    else if (type === "close") this.closeListeners.push(listener as () => void);
    else this.messageListeners.push(listener as (event: { data: string }) => void);
  }
  fireOpen() {
    this.opened = true;
    for (const l of this.openListeners) l();
  }
  deliver(data: string) {
    for (const l of this.messageListeners) l({ data });
  }
}

/** Minimal authoritative arena: clients own transforms; server owns health/kills/respawns. */
class ArenaHub {
  private players = new Map<string, PlayerState>();
  private sockets = new Map<string, HubSocket>();
  private outbox: Array<{ socket: HubSocket; data: string }> = [];
  private nextId = 1;
  private clock = 0;

  /** A deterministic spawn so assertions are stable (arena.ts randomises). */
  private spawn(slot: number): { x: number; z: number } {
    return { x: slot * 10, z: 0 };
  }

  connect(): HubSocket {
    const id = `c${this.nextId++}`;
    const slot = this.players.size + 1;
    const sp = this.spawn(slot);
    const player: PlayerState = {
      id,
      name: "Player",
      avatar: "ranger",
      slot,
      x: sp.x,
      y: 1.8,
      z: sp.z,
      yaw: 0,
      weapon: "Pistol",
      health: 100,
      kills: 0,
      alive: true,
      joined: false,
      acceptedAt: this.clock,
      stateFrames: [],
      hitFrames: [],
    };
    this.players.set(id, player);
    const socket = new HubSocket(id, this);
    this.sockets.set(id, socket);
    const visible = [...this.players.values()].filter((p) => p.id === id || p.joined).map((p) => this.publicPlayer(p));
    this.queue(id, { t: "welcome", id, players: visible });
    return socket;
  }

  receive(senderId: string, raw: string) {
    this.clock += 50;
    let m: { t?: string; [k: string]: unknown };
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const p = this.players.get(senderId);
    if (!p) return;

    if (m.t === "join") {
      p.name = sanitizePlayerName(m.name);
      p.avatar = normalizeAvatarId(m.avatar);
      const wasJoined = p.joined;
      p.joined = true;
      if (!wasJoined) this.broadcast({ t: "join", player: this.publicPlayer(p) }, [senderId]);
      this.broadcast({ t: "name", id: p.id, name: p.name, avatar: p.avatar, slot: p.slot });
    } else if (m.t === "state") {
      if (!p.joined) return;
      const cadence = acceptCadence(p.stateFrames, this.clock, ARENA_POLICY.maxStateFramesPerWindow);
      if (!cadence) return;
      p.stateFrames = cadence;
      const pose = acceptClientPose(p, m, this.clock);
      if (!pose) return;
      p.x = pose.x;
      p.y = pose.y;
      p.z = pose.z;
      p.yaw = pose.yaw;
      p.acceptedAt = pose.acceptedAt;
      p.weapon = acceptWeaponName(m.weapon, p.weapon);
      this.broadcast({ t: "state", id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, weapon: p.weapon, health: p.health }, [
        senderId,
      ]);
    } else if (m.t === "hit") {
      if (!p.joined || typeof m.target !== "string") return;
      const cadence = acceptCadence(p.hitFrames, this.clock, ARENA_POLICY.maxHitFramesPerWindow);
      if (!cadence) return;
      p.hitFrames = cadence;
      const target = this.players.get(String(m.target));
      if (!target?.joined || !target.alive || target.id === p.id) return;
      const dmg = acceptDamageClaim(p, target, m.dmg);
      if (dmg === null) return;
      target.health = Math.max(0, target.health - dmg);
      let killed = false;
      let respawn: { x: number; y: number; z: number } | null = null;
      if (target.health <= 0) {
        killed = true;
        p.kills += 1;
        target.x = 5;
        target.y = 1.8;
        target.z = 5;
        target.health = 100;
        target.alive = true;
        respawn = { x: target.x, y: target.y, z: target.z };
      }
      this.broadcast({
        t: "hit",
        target: target.id,
        by: p.id,
        byName: p.name,
        health: target.health,
        killed,
        killerKills: p.kills,
        respawn,
      });
    }
  }

  handleClose(id: string) {
    if (!this.players.delete(id)) return;
    this.sockets.delete(id);
    this.broadcast({ t: "leave", id });
  }

  private publicPlayer(p: PlayerState) {
    const { acceptedAt: _acceptedAt, stateFrames: _stateFrames, hitFrames: _hitFrames, ...visible } = p;
    return visible;
  }

  private broadcast(message: object, exclude: string[] = []) {
    const data = JSON.stringify(message);
    for (const [id, socket] of this.sockets) {
      if (exclude.includes(id)) continue;
      this.outbox.push({ socket, data });
    }
  }

  private queue(id: string, message: object) {
    const socket = this.sockets.get(id);
    if (socket) this.outbox.push({ socket, data: JSON.stringify(message) });
  }

  /** Drive every pending open + deliver every queued frame until the system is quiet. */
  settle() {
    let safety = 1000;
    for (;;) {
      let changed = false;
      for (const socket of this.sockets.values()) {
        if (!socket.opened) {
          socket.fireOpen(); // → transport reports connected → client sends "join"
          changed = true;
        }
      }
      if (this.outbox.length) {
        const batch = this.outbox;
        this.outbox = [];
        for (const { socket, data } of batch) socket.deliver(data);
        changed = true;
      }
      if (!changed) return;
      if (--safety <= 0) throw new Error("ArenaHub.settle did not converge");
    }
  }
}

// --- A test client wired exactly like MultiplayerSystem, with stub peers ---

class TestPeer implements RemotePeer {
  readonly id: string;
  name: string;
  kills: number;
  health: number;
  target = { x: 0, y: 0, z: 0, yaw: 0 };
  disposed = 0;
  constructor(info: RemotePlayerInfo) {
    this.id = info.id;
    this.name = info.name;
    this.kills = info.kills;
    this.health = info.health;
  }
  setTarget(x: number, y: number, z: number, yaw: number) {
    this.target = { x, y, z, yaw };
  }
  setHealth(h: number) {
    this.health = h;
  }
  setMeta(name: string, kills: number) {
    this.name = name;
    this.kills = kills;
  }
  dispose() {
    this.disposed++;
  }
}

interface SelfState {
  health: number;
  kills: number;
  deaths: number;
}

interface Client {
  transport: NetTransport;
  presence: PresenceRegistry<RemotePlayerInfo, TestPeer>;
  self: SelfState;
}

function makeClient(hub: ArenaHub, name: string, avatar = "ranger"): Client {
  const transport = createTransport({ socketFactory: () => hub.connect() });
  const presence = createPresenceRegistry<RemotePlayerInfo, TestPeer>((info) => new TestPeer(info));
  const self: SelfState = { health: 100, kills: 0, deaths: 0 };

  transport.onStatus((c) => {
    if (c) transport.emit("join", { name, avatar });
  });
  transport.on("welcome", (m) => {
    const selfId = String(m.id);
    presence.selfId = selfId;
    const players = (m.players as RemotePlayerInfo[] | undefined) ?? [];
    for (const p of players) if (p.id !== selfId) presence.add(p);
  });
  transport.on("join", (m) => {
    const player = m.player as RemotePlayerInfo | undefined;
    if (player) presence.add(player);
  });
  transport.on("leave", (m) => presence.remove(String(m.id)));
  transport.on("state", (m) => {
    const r = presence.get(String(m.id));
    if (!r) return;
    r.setTarget(Number(m.x), Number(m.y), Number(m.z), Number(m.yaw));
    const health = Number(m.health);
    if (Number.isFinite(health)) r.setHealth(health);
  });
  transport.on("name", (m) => {
    const r = presence.get(String(m.id));
    if (r) r.setMeta(String(m.name), r.kills);
  });
  transport.on("hit", (m) => {
    const msg = m as unknown as HitMessage;
    const selfId = presence.selfId;
    if (msg.target === selfId) {
      self.health = msg.health;
      if (msg.killed) self.deaths++;
    } else {
      const r = presence.get(msg.target);
      if (r) r.setHealth(msg.health);
    }
    if (msg.by === selfId) {
      self.kills = msg.killerKills;
    } else {
      const rk = presence.get(msg.by);
      if (rk) rk.setMeta(rk.name, msg.killerKills);
    }
  });

  transport.connect("ARENA-TEST");
  return { transport, presence, self };
}

describe("multiplayer transport + presence (2-client PvP arena preview)", () => {
  it("two clients join and see each other as peers", () => {
    const hub = new ArenaHub();
    const a = makeClient(hub, "Ana");
    const b = makeClient(hub, "Bo");
    hub.settle();

    expect(a.transport.connected).toBe(true);
    expect(b.transport.connected).toBe(true);
    expect(a.presence.size).toBe(1);
    expect(b.presence.size).toBe(1);

    const aSeesB = [...a.presence.values()][0];
    const bSeesA = [...b.presence.values()][0];
    expect(aSeesB.name).toBe("Bo");
    expect(bSeesA.name).toBe("Ana");
    expect(aSeesB.id).toBe(b.presence.selfId);
    expect(bSeesA.id).toBe(a.presence.selfId);
  });

  it("transform updates propagate to the other client's peer", () => {
    const hub = new ArenaHub();
    const a = makeClient(hub, "Ana");
    const b = makeClient(hub, "Bo");
    hub.settle();

    // A client owns its transform but NOT its health: the server stamps the
    // authoritative health onto every broadcast `state`, so the spoofed 88 is
    // dropped and the peer still reads the server-owned 100.
    a.transport.emit("state", { x: 8, y: 1.8, z: -2, yaw: 1.2, weapon: "Pistol", health: 88 });
    hub.settle();

    const bSeesA = b.presence.get(a.presence.selfId);
    expect(bSeesA?.target.x).toBe(8);
    expect(bSeesA?.target.z).toBe(-2);
    expect(bSeesA?.health).toBe(100);
  });

  it("the server owns hit resolution: damage, lethal kills, and kill credit", () => {
    const hub = new ArenaHub();
    const a = makeClient(hub, "Ana");
    const b = makeClient(hub, "Bo");
    hub.settle();
    const bId = b.presence.selfId;

    // Non-lethal hit: Bo drops to 70, no kill credited.
    a.transport.emit("hit", { target: bId, dmg: 30 });
    hub.settle();
    expect(b.self.health).toBe(70);
    expect(a.presence.get(bId)?.health).toBe(70);
    expect(a.self.kills).toBe(0);
    expect(b.self.deaths).toBe(0);

    // Lethal hit: server zeroes then respawns Bo at full, credits Ana a kill.
    a.transport.emit("hit", { target: bId, dmg: 70 });
    hub.settle();
    expect(a.self.kills).toBe(1);
    expect(b.self.deaths).toBe(1);
    expect(b.self.health).toBe(100); // respawned at full
    expect(a.presence.get(bId)?.health).toBe(100);
  });

  it("a client that leaves is removed from the other's presence and disposed", () => {
    const hub = new ArenaHub();
    const a = makeClient(hub, "Ana");
    const b = makeClient(hub, "Bo");
    hub.settle();

    const bSeesA = b.presence.get(a.presence.selfId);
    expect(bSeesA).toBeDefined();

    a.transport.disconnect();
    hub.settle();

    expect(b.presence.size).toBe(0);
    expect(bSeesA?.disposed).toBe(1);
    expect(a.transport.connected).toBe(false);
  });

  it("a self-hit is rejected by the server and broadcasts nothing", () => {
    const hub = new ArenaHub();
    const a = makeClient(hub, "Ana");
    const b = makeClient(hub, "Bo");
    hub.settle();

    // Self-hit: server ignores it (target === sender) — no health change, no kill,
    // and crucially no `hit` broadcast, so the other client still sees Ana at full.
    a.transport.emit("hit", { target: a.presence.selfId, dmg: 50 });
    hub.settle();
    expect(a.self.health).toBe(100);
    expect(a.self.kills).toBe(0);
    expect(b.presence.get(a.presence.selfId)?.health).toBe(100);
  });
});
