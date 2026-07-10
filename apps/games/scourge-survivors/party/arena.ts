import type * as Party from "partykit/server";
import {
  ARENA_POLICY,
  acceptCadence,
  acceptClientPose,
  acceptDamageClaim,
  acceptWeaponName,
  normalizeAvatarId,
  parseArenaFrame,
  sanitizePlayerName,
} from "./arenaPolicy";

// Unauthenticated PvP arena preview. Clients propose their own transform and
// hit claims. The server owns the accepted transform, registration/slots,
// health, frag credit, and respawns so those truths cannot desync between peers.

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
  joinFrames: number[];
  stateFrames: number[];
  hitFrames: number[];
}

const SPAWN_MIN = 18;
const SPAWN_MAX = 34;

function spawnPoint(): { x: number; z: number } {
  const a = Math.random() * Math.PI * 2;
  const r = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

export default class Arena implements Party.Server {
  players = new Map<string, PlayerState>();

  constructor(
    readonly room: Party.Room,
    private readonly now: () => number = Date.now,
    private readonly spawn: () => { x: number; z: number } = spawnPoint,
  ) {}

  private nextSlot(): number {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    for (let slot = 1; slot < 99; slot++) {
      if (!used.has(slot)) return slot;
    }
    return used.size + 1;
  }

  onConnect(conn: Party.Connection) {
    const sp = this.spawn();
    const acceptedAt = this.now();
    const p: PlayerState = {
      id: conn.id,
      name: "Player",
      avatar: "ranger",
      slot: this.nextSlot(),
      x: sp.x,
      y: 1.8,
      z: sp.z,
      yaw: 0,
      weapon: "Pistol",
      health: 100,
      kills: 0,
      alive: true,
      joined: false,
      acceptedAt,
      joinFrames: [],
      stateFrames: [],
      hitFrames: [],
    };
    this.players.set(conn.id, p);
    const visiblePlayers = [...this.players.values()]
      .filter((player) => player.id === conn.id || player.joined)
      .map((player) => this.publicPlayer(player));
    conn.send(JSON.stringify({ t: "welcome", id: conn.id, players: visiblePlayers }));
  }

  onMessage(raw: string, sender: Party.Connection) {
    const m = parseArenaFrame(raw);
    if (!m) return;
    const p = this.players.get(sender.id);
    if (!p) return;
    const now = this.now();

    if (m.t === "join") {
      const cadence = acceptCadence(p.joinFrames, now, ARENA_POLICY.maxJoinFramesPerWindow);
      if (!cadence) return;
      p.joinFrames = cadence;
      p.name = sanitizePlayerName(m.name);
      p.avatar = normalizeAvatarId(m.avatar);
      const wasJoined = p.joined;
      p.joined = true;
      if (!wasJoined) this.broadcastToJoined({ t: "join", player: this.publicPlayer(p) }, [sender.id]);
      this.broadcastToJoined({ t: "name", id: p.id, name: p.name, avatar: p.avatar, slot: p.slot });
    } else if (m.t === "state") {
      if (!p.joined) return;
      const cadence = acceptCadence(p.stateFrames, now, ARENA_POLICY.maxStateFramesPerWindow);
      if (!cadence) return;
      p.stateFrames = cadence;
      const pose = acceptClientPose(p, m, now);
      if (!pose) return;
      p.x = pose.x;
      p.y = pose.y;
      p.z = pose.z;
      p.yaw = pose.yaw;
      p.acceptedAt = pose.acceptedAt;
      p.weapon = acceptWeaponName(m.weapon, p.weapon);
      this.broadcastToJoined(
        { t: "state", id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, weapon: p.weapon, health: p.health },
        [sender.id],
      );
    } else if (m.t === "hit") {
      if (!p.joined || typeof m.target !== "string") return;
      const cadence = acceptCadence(p.hitFrames, now, ARENA_POLICY.maxHitFramesPerWindow);
      if (!cadence) return;
      p.hitFrames = cadence;
      const target = this.players.get(m.target);
      if (!target?.joined || !target.alive || target.id === p.id) return;
      const dmg = acceptDamageClaim(p, target, m.dmg);
      if (dmg === null) return;
      target.health = Math.max(0, target.health - dmg);
      let killed = false;
      let respawn: { x: number; y: number; z: number } | null = null;
      if (target.health <= 0) {
        killed = true;
        p.kills += 1;
        const s = this.spawn();
        target.x = s.x;
        target.y = 1.8;
        target.z = s.z;
        target.health = 100;
        target.alive = true;
        target.acceptedAt = now;
        respawn = { x: target.x, y: target.y, z: target.z };
      }
      this.broadcastToJoined({
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

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    if (player?.joined) this.broadcastToJoined({ t: "leave", id: conn.id });
  }

  private publicPlayer(p: PlayerState) {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      slot: p.slot,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      weapon: p.weapon,
      health: p.health,
      kills: p.kills,
      alive: p.alive,
      joined: p.joined,
    };
  }

  private broadcastToJoined(message: object, exclude: string[] = []) {
    const excluded = new Set(exclude);
    for (const player of this.players.values()) {
      if (!player.joined) excluded.add(player.id);
    }
    this.room.broadcast(JSON.stringify(message), [...excluded]);
  }
}
