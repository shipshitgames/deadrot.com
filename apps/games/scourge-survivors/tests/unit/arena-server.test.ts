import type * as Party from "partykit/server";
import { describe, expect, it } from "vitest";
import Arena from "../../party/arena";
import { ARENA_POLICY } from "../../party/arenaPolicy";

interface SentFrame {
  message: string;
  without: string[];
}

class FakeRoom {
  broadcasts: SentFrame[] = [];

  broadcast(message: string, without: string[] = []) {
    this.broadcasts.push({ message, without });
  }
}

function fakeConnection(id: string) {
  const messages: string[] = [];
  const connection = {
    id,
    send: (message: string) => messages.push(message),
  } as unknown as Party.Connection;
  return { connection, messages };
}

function decoded(frames: SentFrame[], type: string): Array<Record<string, unknown>> {
  return frames
    .map((frame) => JSON.parse(frame.message) as Record<string, unknown>)
    .filter((frame) => frame.t === type);
}

function setup(spawns: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }]) {
  let clock = 0;
  let spawnIndex = 0;
  const room = new FakeRoom();
  const arena = new Arena(
    room as unknown as Party.Room,
    () => clock,
    () => spawns[Math.min(spawnIndex++, spawns.length - 1)],
  );
  const advance = (ms: number) => {
    clock += ms;
  };
  const connect = (id: string, join = true) => {
    const client = fakeConnection(id);
    arena.onConnect(client.connection);
    if (join) arena.onMessage(JSON.stringify({ t: "join", name: id, avatar: "ranger" }), client.connection);
    return client;
  };
  return { arena, room, advance, connect };
}

describe("PartyKit PvP arena preview authority", () => {
  it("accepts only bounded object frames and requires join before state or hits", () => {
    const { arena, room, connect } = setup([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]);
    const a = connect("a", false);
    connect("b");
    room.broadcasts = [];

    arena.onMessage("[]", a.connection);
    arena.onMessage(`{"t":"state","pad":"${"x".repeat(ARENA_POLICY.maxFrameChars)}"}`, a.connection);
    arena.onMessage(JSON.stringify({ t: "state", x: 1, y: 1.8, z: 1, yaw: 0, weapon: "Pistol" }), a.connection);
    arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg: 30 }), a.connection);

    expect(room.broadcasts).toHaveLength(0);
    expect(arena.players.get("b")?.health).toBe(100);
  });

  it("sanitizes join metadata and never exposes rate-limit bookkeeping", () => {
    const { arena, room, connect } = setup();
    const a = connect("a", false);
    room.broadcasts = [];

    arena.onMessage(JSON.stringify({ t: "join", name: "  A\u0000ce  ", avatar: "hacker" }), a.connection);

    const name = decoded(room.broadcasts, "name").at(-1);
    expect(name).toMatchObject({ id: "a", name: "Ace", avatar: "ranger", slot: 1 });
    const joined = arena.players.get("a");
    expect(joined?.joined).toBe(true);
    expect(JSON.stringify(name)).not.toContain("Frames");
  });

  it("records and broadcasts only finite, bounded, speed-capped poses and whitelisted weapons", () => {
    const { arena, room, advance, connect } = setup([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]);
    const a = connect("a");
    connect("b");
    room.broadcasts = [];

    advance(50);
    arena.onMessage('{"t":"state","x":1e309,"y":1.8,"z":0,"yaw":0,"weapon":"Pistol"}', a.connection);
    arena.onMessage(JSON.stringify({ t: "state", x: "1", y: 1.8, z: 0, yaw: 0, weapon: "Pistol" }), a.connection);
    expect(decoded(room.broadcasts, "state")).toHaveLength(0);

    arena.onMessage(JSON.stringify({ t: "state", x: 500, y: 99, z: 0, yaw: Math.PI * 4, weapon: "BFG" }), a.connection);
    const state = decoded(room.broadcasts, "state").at(-1);
    const maxStep = ARENA_POLICY.movementSlack + ARENA_POLICY.maxHorizontalSpeed * 0.05;
    expect(Number(state?.x)).toBeCloseTo(maxStep);
    expect(state).toMatchObject({ y: ARENA_POLICY.maxY, z: 0, yaw: 0, weapon: "Pistol", health: 100 });
    expect(arena.players.get("a")?.x).toBeCloseTo(Number(state?.x));
  });

  it("rejects invalid, distant, and over-cadence hit claims", () => {
    const distant = setup([
      { x: 0, z: 0 },
      { x: ARENA_POLICY.maxHitRange + 1, z: 0 },
    ]);
    const distantA = distant.connect("a");
    distant.connect("b");
    distant.room.broadcasts = [];
    distant.arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg: 30 }), distantA.connection);
    expect(decoded(distant.room.broadcasts, "hit")).toHaveLength(0);

    const local = setup([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]);
    const a = local.connect("a");
    local.connect("b");
    local.room.broadcasts = [];
    for (const dmg of [0, -1, Number.NaN, String(30), ARENA_POLICY.maxClaimDamage + 1]) {
      local.arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg }), a.connection);
    }
    for (let i = 0; i <= ARENA_POLICY.maxHitFramesPerWindow; i++) {
      local.arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg: 1 }), a.connection);
    }
    expect(decoded(local.room.broadcasts, "hit")).toHaveLength(ARENA_POLICY.maxHitFramesPerWindow - 5);
  });

  it("keeps health, frag credit, and respawn server-owned across two joined clients", () => {
    const { arena, room, connect } = setup([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 5, z: 5 },
    ]);
    const a = connect("a");
    connect("b");
    room.broadcasts = [];

    arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg: 30 }), a.connection);
    arena.onMessage(JSON.stringify({ t: "hit", target: "b", dmg: 70 }), a.connection);

    const hits = decoded(room.broadcasts, "hit");
    expect(hits[0]).toMatchObject({ target: "b", by: "a", health: 70, killed: false, killerKills: 0 });
    expect(hits[1]).toMatchObject({
      target: "b",
      by: "a",
      health: 100,
      killed: true,
      killerKills: 1,
      respawn: { x: 5, y: 1.8, z: 5 },
    });
    expect(arena.players.get("a")?.kills).toBe(1);
    expect(arena.players.get("b")?.health).toBe(100);
  });
});
