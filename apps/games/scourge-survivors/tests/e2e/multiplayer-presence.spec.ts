// Issue #94 — Extract transport and presence.
//
// Browser-level proof of the extracted net stack (`@deadrot/game-kit/net`,
// wired through `MultiplayerSystem` + `RemoteAvatar`). The game runs a PvP preview
// session against an in-page loopback hub that mirrors `party/arena.ts`'s wire
// protocol, injected through the DEV-only `window.__fpsSocketFactory` seam — so no
// live PartyKit server is needed. A scripted bot joins, moves, gets shot, and
// leaves; we assert presence, transform interpolation, server-owned hit
// resolution, and disposal entirely through the game's own debug snapshot.
import { expect, type Page, test } from "@playwright/test";
import { ARENA_POLICY } from "../../party/arenaPolicy";

type MpSnapshot = {
  active: boolean;
  connected: boolean;
  selfId: string;
  room: string;
  peers: Array<{ id: string; name: string; kills: number; health: number; x: number; z: number }>;
};

/**
 * A faithful in-browser stand-in for the PartyKit Arena room. Clients own their
 * transform; the server owns health/kills/respawns. Spawns are deterministic
 * (slot*10, 0) so transform assertions are stable. Installed before any page
 * script via addInitScript and exposed through the DEV socket-factory seam.
 */
const LOOPBACK_HUB_SCRIPT = `
(() => {
  const POLICY = ${JSON.stringify(ARENA_POLICY)};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const acceptCadence = (history, now, maxFrames) => {
    const recent = history.filter((stamp) => stamp > now - POLICY.rateWindowMs);
    return recent.length >= maxFrames ? null : [...recent, now];
  };
  const acceptPose = (current, m, now) => {
    if (![m.x, m.y, m.z, m.yaw].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
    const x = m.x, y = m.y, z = m.z, yaw = m.yaw;
    const edge = POLICY.arenaHalf - POLICY.playerRadius;
    const desiredX = clamp(x, -edge, edge), desiredZ = clamp(z, -edge, edge);
    const elapsed = clamp((now - current.acceptedAt) / 1000, 0, POLICY.maxCatchupSeconds);
    const maxStep = POLICY.movementSlack + POLICY.maxHorizontalSpeed * elapsed;
    const dx = desiredX - current.x, dz = desiredZ - current.z, distance = Math.hypot(dx, dz);
    const scale = distance > maxStep && distance > 0 ? maxStep / distance : 1;
    const wrappedYaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return { x: current.x + dx * scale, y: clamp(y, POLICY.minY, POLICY.maxY), z: current.z + dz * scale, yaw: wrappedYaw, acceptedAt: now };
  };
  const acceptDamage = (shooter, target, value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const damage = value;
    if (damage <= 0 || damage > POLICY.maxClaimDamage) return null;
    if (Math.hypot(target.x - shooter.x, target.z - shooter.z) > POLICY.maxHitRange) return null;
    return Math.round(damage * 100) / 100;
  };

  class HubSocket {
    constructor(id, hub) {
      this.id = id;
      this.hub = hub;
      this.readyState = 0; // CONNECTING — flips to OPEN on the next microtask
      this._open = [];
      this._close = [];
      this._msg = [];
      queueMicrotask(() => {
        this.readyState = 1;
        for (const l of this._open) l();
      });
    }
    send(data) { this.hub.receive(this.id, data); }
    close() {
      this.readyState = 3;
      this.hub.handleClose(this.id);
      for (const l of this._close) l();
    }
    addEventListener(type, listener) {
      if (type === "open") this._open.push(listener);
      else if (type === "close") this._close.push(listener);
      else this._msg.push(listener);
    }
    deliver(data) { for (const l of this._msg) l({ data }); }
  }

  class ArenaHub {
    constructor() {
      this.players = new Map();
      this.sockets = new Map();
      this.outbox = [];
      this.nextId = 1;
      this.flushing = false;
      this.clock = 0;
    }
    spawn(slot) { return { x: slot * 10, z: 0 }; }
    connect() {
      const id = "c" + this.nextId++;
      const slot = this.players.size + 1;
      const sp = this.spawn(slot);
      const player = { id, name: "Player", avatar: "ranger", slot, x: sp.x, y: 1.8, z: sp.z, yaw: 0, weapon: "Pistol", health: 100, kills: 0, alive: true, joined: false, acceptedAt: this.clock, stateFrames: [], hitFrames: [] };
      this.players.set(id, player);
      const socket = new HubSocket(id, this);
      this.sockets.set(id, socket);
      const visible = [...this.players.values()].filter((p) => p.id === id || p.joined).map((p) => this.publicPlayer(p));
      this.queue(id, { t: "welcome", id, players: visible });
      return socket;
    }
    receive(senderId, raw) {
      this.clock += 50;
      let m;
      try { m = JSON.parse(raw); } catch (_e) { return; }
      const p = this.players.get(senderId);
      if (!p) return;
      if (m.t === "join") {
        p.name = String(m.name != null ? m.name : "Player").replace(/[\\u0000-\\u001f\\u007f]/g, "").trim().slice(0, 16) || "Player";
        p.avatar = ["ranger", "heavy", "scout", "medic"].includes(String(m.avatar)) ? String(m.avatar) : "ranger";
        const wasJoined = p.joined;
        p.joined = true;
        if (!wasJoined) {
          for (const peer of this.players.values()) {
            if (peer.id !== p.id && peer.joined) this.queue(senderId, { t: "join", player: this.publicPlayer(peer) });
          }
          this.broadcast({ t: "join", player: this.publicPlayer(p) }, [senderId]);
        }
        this.broadcast({ t: "name", id: p.id, name: p.name, avatar: p.avatar, slot: p.slot });
      } else if (m.t === "state") {
        if (!p.joined) { this.scheduleFlush(); return; }
        const cadence = acceptCadence(p.stateFrames, this.clock, POLICY.maxStateFramesPerWindow);
        if (!cadence) { this.scheduleFlush(); return; }
        p.stateFrames = cadence;
        const pose = acceptPose(p, m, this.clock);
        if (!pose) { this.scheduleFlush(); return; }
        Object.assign(p, pose);
        if (["Pistol", "SMG", "Shotgun", "Cannon", "Sniper"].includes(m.weapon)) p.weapon = m.weapon;
        this.broadcast({ t: "state", id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, weapon: p.weapon, health: p.health }, [senderId]);
      } else if (m.t === "hit") {
        if (!p.joined || typeof m.target !== "string") { this.scheduleFlush(); return; }
        const cadence = acceptCadence(p.hitFrames, this.clock, POLICY.maxHitFramesPerWindow);
        if (!cadence) { this.scheduleFlush(); return; }
        p.hitFrames = cadence;
        const target = this.players.get(String(m.target));
        if (!target || !target.joined || !target.alive || target.id === p.id) { this.scheduleFlush(); return; }
        const dmg = acceptDamage(p, target, m.dmg);
        if (dmg === null) { this.scheduleFlush(); return; }
        target.health = Math.max(0, target.health - dmg);
        let killed = false;
        let respawn = null;
        if (target.health <= 0) {
          killed = true;
          p.kills += 1;
          target.x = 5; target.y = 1.8; target.z = 5;
          target.health = 100; target.alive = true;
          respawn = { x: target.x, y: target.y, z: target.z };
        }
        this.broadcast({ t: "hit", target: target.id, by: p.id, byName: p.name, health: target.health, killed, killerKills: p.kills, respawn });
      }
      this.scheduleFlush();
    }
    handleClose(id) {
      if (!this.players.delete(id)) return;
      this.sockets.delete(id);
      this.broadcast({ t: "leave", id });
      this.scheduleFlush();
    }
    publicPlayer(player) {
      const { acceptedAt: _acceptedAt, stateFrames: _stateFrames, hitFrames: _hitFrames, ...visible } = player;
      return visible;
    }
    broadcast(message, exclude) {
      const skip = exclude || [];
      const data = JSON.stringify(message);
      for (const [id, socket] of this.sockets) {
        if (skip.includes(id)) continue;
        this.outbox.push({ socket, data });
      }
    }
    queue(id, message) {
      const socket = this.sockets.get(id);
      if (socket) this.outbox.push({ socket, data: JSON.stringify(message) });
      this.scheduleFlush();
    }
    scheduleFlush() {
      if (this.flushing) return;
      this.flushing = true;
      queueMicrotask(() => {
        this.flushing = false;
        const batch = this.outbox;
        this.outbox = [];
        for (const item of batch) item.socket.deliver(item.data);
        if (this.outbox.length) this.scheduleFlush();
      });
    }
  }

  const hub = new ArenaHub();
  window.__fpsSocketFactory = () => hub.connect();
  window.__arena = {
    addBot(name, avatar) {
      const sock = hub.connect();
      const inbox = [];
      sock.addEventListener("message", (e) => { try { inbox.push(JSON.parse(e.data)); } catch (_e) {} });
      const bot = {
        id: sock.id,
        inbox,
        join: () => sock.send(JSON.stringify({ t: "join", name, avatar: avatar || "ranger" })),
        state: (s) => sock.send(JSON.stringify(Object.assign({ t: "state" }, s))),
        hit: (target, dmg) => sock.send(JSON.stringify({ t: "hit", target, dmg })),
        leave: () => sock.close(),
      };
      window.__bot = bot;
      return bot.id;
    },
  };
})();
`;

type FpsWindow = {
  __fpsGame: {
    startMultiplayer: (room: string, name: string, avatar: string) => void;
    multiplayerDebugSnapshot: () => MpSnapshot;
    ctx: { status: string };
    sys: { multiplayer: { sendHit: (target: string, dmg: number) => void } };
  };
  __arena: { addBot: (name: string, avatar: string) => string };
  __bot: {
    id: string;
    join: () => void;
    state: (s: { x: number; y: number; z: number; yaw: number; weapon: string; health: number }) => void;
    hit: (target: string, dmg: number) => void;
    leave: () => void;
  };
};

async function mpSnapshot(page: Page): Promise<MpSnapshot> {
  return page.evaluate(() => (window as unknown as FpsWindow).__fpsGame.multiplayerDebugSnapshot());
}

/** Launch the game and join a PvP preview room over the loopback hub, sim loop unblocked. */
async function startRoom(page: Page): Promise<void> {
  await page.addInitScript(LOOPBACK_HUB_SCRIPT);
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await page.evaluate(() => {
    const w = window as unknown as FpsWindow;
    w.__fpsGame.startMultiplayer("ARENA-E2E", "Ace", "ranger");
    // No pointer lock headless, so force the playing state the sim loop gates on.
    w.__fpsGame.ctx.status = "playing";
  });
  await expect.poll(() => mpSnapshot(page).then((s) => s.connected && s.selfId !== "")).toBe(true);
}

/** A second player joins the same hub and announces itself. Returns the bot's id. */
async function joinBot(page: Page, name: string, avatar: string): Promise<string> {
  return page.evaluate(
    ([n, a]) => {
      const w = window as unknown as FpsWindow;
      const id = w.__arena.addBot(n, a);
      w.__bot.join();
      return id;
    },
    [name, avatar] as const,
  );
}

test.describe("multiplayer presence (extracted transport + presence)", () => {
  test("a peer joins, moves, takes a validated server-resolved hit, and leaves", async ({ page }) => {
    await startRoom(page);

    // Solo to start: connected, self identified, no peers yet.
    const solo = await mpSnapshot(page);
    expect(solo.active).toBe(true);
    expect(solo.room).toBe("ARENA-E2E");
    expect(solo.peers).toHaveLength(0);

    // A second player joins → presence registry builds exactly one peer avatar.
    const botId = await joinBot(page, "Bot", "heavy");
    await expect.poll(() => mpSnapshot(page).then((s) => s.peers.length)).toBe(1);
    const joined = await mpSnapshot(page);
    expect(joined.peers[0].id).toBe(botId);
    expect(joined.peers[0].name).toBe("Bot");
    expect(joined.peers[0].health).toBe(100);
    expect(botId).not.toBe(joined.selfId);

    // The peer broadcasts a transform; the avatar lerps toward it in-scene.
    await page.evaluate(() => {
      (window as unknown as FpsWindow).__bot.state({ x: 19, y: 1.8, z: -1, yaw: 1.0, weapon: "Pistol", health: 88 });
    });
    await expect
      .poll(() => mpSnapshot(page).then((s) => Math.hypot(s.peers[0].x - 19, s.peers[0].z + 1) < 0.4))
      .toBe(true);

    // The local player shoots the peer; the server (hub) owns the damage outcome.
    await page.evaluate((target) => {
      (window as unknown as FpsWindow).__fpsGame.sys.multiplayer.sendHit(target, 30);
    }, botId);
    await expect.poll(() => mpSnapshot(page).then((s) => s.peers[0]?.health)).toBe(70);

    // Oversized client damage is only a claim and must not alter server-owned health.
    await page.evaluate((target) => {
      (window as unknown as FpsWindow).__fpsGame.sys.multiplayer.sendHit(target, 999);
    }, botId);
    await expect.poll(() => mpSnapshot(page).then((s) => s.peers[0]?.health)).toBe(70);

    // The peer disconnects → presence removes and disposes its avatar.
    await page.evaluate(() => {
      (window as unknown as FpsWindow).__bot.leave();
    });
    await expect.poll(() => mpSnapshot(page).then((s) => s.peers.length)).toBe(0);
    expect((await mpSnapshot(page)).connected).toBe(true); // our own socket stays up
  });
});
