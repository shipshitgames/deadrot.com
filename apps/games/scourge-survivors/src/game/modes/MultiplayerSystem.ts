import type { NetTransport } from "@deadrot/game-kit/net";
import * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import {
  createFpsPresence,
  createFpsTransport,
  type FpsPresence,
  type HitMessage,
  type RemotePlayerInfo,
} from "../../net/fpsNet";
import type { PlayerAvatarId } from "../../net/playerAvatars";
import { RemoteAvatar } from "../../net/RemoteAvatar";
import { PLAYER_HEIGHT, WEAPONS } from "../constants";
import type { GameContext } from "../context";
import { DEFAULT_MAP_ID, getMap } from "../data/maps";
import type { GameSystems } from "../systems";

/** Snapshot of PvP arena preview state for tests/debug harnesses. */
export interface MultiplayerDebugSnapshot {
  active: boolean;
  connected: boolean;
  selfId: string;
  room: string;
  peers: Array<{ id: string; name: string; kills: number; health: number; x: number; z: number }>;
}

export class MultiplayerSystem {
  // PvP preview room state. The generic transport owns the wire; the presence
  // registry owns the set of remote avatars. Both are null outside a session.
  transport: NetTransport | null = null;
  presence: FpsPresence<RemoteAvatar> | null = null;
  connected = false;
  roomName = "";
  playerName = "Player";
  playerAvatar: PlayerAvatarId = "ranger";
  _euler = new THREE.Euler(0, 0, 0, "YXZ");

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  /** True while a PvP preview session is live (a transport exists). */
  get active(): boolean {
    return this.transport !== null;
  }

  /** Live remote avatars; safe to call outside a session (yields nothing). */
  peers(): RemoteAvatar[] {
    return this.presence ? [...this.presence.values()] : [];
  }

  /** Report a melee/projectile hit on a remote peer; the server owns the outcome. */
  sendHit(target: string, dmg: number): void {
    this.transport?.emit("hit", { target, dmg });
  }

  startMultiplayer(room: string, name: string, avatar: PlayerAvatarId = "ranger") {
    this.leaveMultiplayer(false); // tear down any prior session/avatars first
    this.sys.mission.clearMissionState();
    this.ctx.campaignStage = 0;
    this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID)); // PvP preview uses the default arena.
    this.sys.player.resetPlayer();
    this.ctx.multiplayer = true;
    this.connected = false;
    this.roomName = room;
    this.playerName = name || "Player";
    this.playerAvatar = avatar;
    this.ctx.kills = 0;

    // The preview is a player-vs-player arena, so solo PvE progression is absent.
    for (const e of this.ctx.enemies) e.kill();
    this.sys.pve.suspendWaves();
    this.sys.pve.bossActive = false;
    this.sys.pve.bossEnemy = null;
    this.sys.projectiles.clearProjectiles();
    while (this.sys.pickups.pickups.length) this.sys.pickups.removePickup(this.sys.pickups.pickups.length - 1);

    const presence = createFpsPresence<RemoteAvatar>((info) => new RemoteAvatar(info), {
      onAdd: (avatarObj) => {
        this.ctx.scene.add(avatarObj.group);
        this.ctx.raycastTargets.push(...avatarObj.hitMeshes);
      },
      onRemove: (avatarObj) => {
        this.ctx.scene.remove(avatarObj.group);
        this.ctx.raycastTargets = this.ctx.raycastTargets.filter((o) => !avatarObj.hitMeshes.includes(o as THREE.Mesh));
      },
    });
    this.presence = presence;

    const transport = createFpsTransport();
    this.transport = transport;

    transport.onStatus((c) => {
      this.connected = c;
      if (c) transport.emit("join", { name: this.playerName, avatar: this.playerAvatar });
      this.sys.hud.emit();
    });
    transport.on("welcome", (m) => {
      const selfId = String(m.id);
      presence.selfId = selfId;
      const players = (m.players as RemotePlayerInfo[] | undefined) ?? [];
      for (const p of players) {
        if (p.id === selfId) this.ctx.rig.placeAt(p.x, PLAYER_HEIGHT, p.z, 0, -1);
        else presence.add(p);
      }
      this.sys.hud.emit();
    });
    transport.on("join", (m) => {
      const player = m.player as RemotePlayerInfo | undefined;
      if (player) presence.add(player);
      this.sys.hud.emit();
    });
    transport.on("leave", (m) => {
      presence.remove(String(m.id));
      this.sys.hud.emit();
    });
    transport.on("state", (m) => {
      const r = presence.get(String(m.id));
      if (!r) return;
      r.setTarget(Number(m.x), Number(m.y), Number(m.z), Number(m.yaw));
      const health = Number(m.health);
      if (Number.isFinite(health)) r.setHealth(health);
    });
    transport.on("name", (m) => {
      const r = presence.get(String(m.id));
      if (r) {
        r.setMeta(String(m.name), r.kills, String(m.avatar ?? "ranger"), Number(m.slot ?? 0));
        this.sys.hud.emit();
      }
    });
    transport.on("hit", (m) => this.onNetHit(m as unknown as HitMessage));

    transport.connect(room);

    this.ctx.status = "pointerlock-needed";
    this.sys.hud.emit();
    this.sys.input.requestLock();
  }

  /** Leave the room. If toMenu, return to the solo start menu. */
  leaveMultiplayer(toMenu = true) {
    if (this.transport) {
      this.transport.disconnect();
      this.transport = null;
    }
    if (this.presence) {
      this.presence.clear(); // disposes every avatar + unwires it from the scene
      this.presence = null;
    }
    this.ctx.multiplayer = false;
    this.connected = false;
    this.roomName = "";
    if (toMenu) {
      this.sys.player.resetPlayer();
      this.sys.pve.startWaveSystem();
      this.ctx.status = "pointerlock-needed";
      this.sys.hud.emit();
    }
  }

  onNetHit(msg: HitMessage) {
    const selfId = this.presence?.selfId;
    if (msg.target === selfId) {
      this.ctx.health = msg.health;
      this.sys.hud.damageSeq++;
      audio.sfx("hurt");
      if (msg.killed && msg.respawn) {
        this.ctx.groundY = 0;
        this.ctx.stanceHeight = PLAYER_HEIGHT;
        this.ctx.wantsSprint = false;
        this.ctx.wantsCrouch = false;
        this.ctx.wasSprinting = false;
        this.ctx.sprintStartBoostTimer = 0;
        this.ctx.rig.placeAt(msg.respawn.x, PLAYER_HEIGHT, msg.respawn.z, 0, -1);
        this.ctx.velocity.set(0, 0, 0);
        this.sys.hud.showToast(`DROPPED BY ${msg.byName}`);
      }
    } else {
      const r = this.presence?.get(msg.target);
      if (r) {
        r.setHealth(msg.health);
        if (msg.killed && msg.respawn) {
          r.group.position.set(msg.respawn.x, 0, msg.respawn.z);
          r.setTarget(msg.respawn.x, PLAYER_HEIGHT, msg.respawn.z, 0);
        }
      }
    }
    if (msg.by === selfId) {
      this.ctx.kills = msg.killerKills;
      if (msg.killed) {
        this.sys.hud.killSeq++;
        this.sys.hud.showToast("SYNC KILL");
        audio.sfx("kill");
      }
    } else {
      const rk = this.presence?.get(msg.by);
      if (rk) rk.setMeta(rk.name, msg.killerKills);
    }
    this.sys.hud.emit();
  }

  updateMultiplayer(delta: number) {
    const facing = this.ctx.rig.facing;
    const player = this.ctx.body.position;
    if (this.presence) {
      for (const r of this.presence.values()) r.update(delta, this.ctx.camera.quaternion, this.ctx.camera.position);
    }
    if (this.transport) {
      this._euler.setFromQuaternion(facing, "YXZ");
      const netY = player.y - this.ctx.stanceHeight + PLAYER_HEIGHT;
      this.transport.emitThrottled(
        "state",
        {
          x: player.x,
          y: netY,
          z: player.z,
          yaw: this._euler.y,
          weapon: WEAPONS[this.ctx.activeWeapon].name,
        },
        45, // ~22 Hz; safe to call every frame
      );
    }
  }

  buildScoreboard() {
    const board = [
      { id: "self", name: this.playerName, kills: this.ctx.kills, health: Math.round(this.ctx.health), you: true },
      ...this.peers().map((r) => ({
        id: r.id,
        name: r.name,
        kills: r.kills,
        health: Math.round(r.health),
        you: false,
      })),
    ];
    board.sort((a, b) => b.kills - a.kills);
    return board;
  }

  /** Inspect live room state — used by the e2e harness and debugging. */
  debugSnapshot(): MultiplayerDebugSnapshot {
    return {
      active: this.active,
      connected: this.connected,
      selfId: this.presence?.selfId ?? "",
      room: this.roomName,
      peers: this.peers().map((r) => ({
        id: r.id,
        name: r.name,
        kills: r.kills,
        health: Math.round(r.health),
        x: r.group.position.x,
        z: r.group.position.z,
      })),
    };
  }
}
