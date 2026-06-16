import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera, Vector3 } from "three";

import { HudCoreSystem } from "../src/hud/HudSystem";
import type { HudCore, HudExtension, HudHost } from "../src/hud/types";

/** A Scourge-flavoured extension `E` standing in for any per-game HUD payload. */
interface DemoExt {
  status: "playing" | "gameover";
  ammo: number;
}

/** Mutable host so tests can advance `time` / flip `disposed` mid-run. */
interface MutableHost extends HudHost {
  camera: PerspectiveCamera;
  time: number;
  disposed: boolean;
}

function makeSystem(opts?: { onAnnounce?: (text: string) => void; vitalsHealth?: number }) {
  // A camera at the origin looking down -Z (the three.js default), so a point at
  // (0,0,-5) lands dead-centre and (0,0,5) is behind the lens.
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  camera.updateMatrixWorld(true);

  const host: MutableHost = { camera, time: 0, disposed: false };
  const announced: string[] = [];
  const extension: HudExtension<DemoExt> = {
    vitals: () => ({ playerHealth: opts?.vitalsHealth ?? 80, maxPlayerHealth: 100 }),
    read: () => ({ status: "playing", ammo: 7 }),
    onAnnounce: (text) => {
      announced.push(text);
      opts?.onAnnounce?.(text);
    },
  };

  const frames: HudCore<DemoExt>[] = [];
  const sys = new HudCoreSystem<DemoExt>(host, extension, (frame) => frames.push(frame));
  return { sys, host, frames, announced, camera };
}

test("emit() merges vitals + feedback core + extension into one flat frame", () => {
  const { sys, frames } = makeSystem();
  sys.emit();
  assert.equal(frames.length, 1);
  const f = frames[0]!;
  // Vitals (engine-owned)
  assert.equal(f.playerHealth, 80);
  assert.equal(f.maxPlayerHealth, 100);
  // Feedback channels start at zero
  assert.equal(f.hitSeq, 0);
  assert.equal(f.emphasisSeq, 0);
  assert.equal(f.killSeq, 0);
  assert.equal(f.damageSeq, 0);
  assert.equal(f.banner, "");
  assert.equal(f.bannerSeq, 0);
  assert.equal(f.toast, "");
  assert.equal(f.toastSeq, 0);
  assert.deepEqual(f.damageNumbers, []);
  // Extension fields read flat alongside the core
  assert.equal(f.status, "playing");
  assert.equal(f.ammo, 7);
});

test("monotonic feedback channels flow through to the next frame", () => {
  const { sys, frames } = makeSystem();
  sys.hitSeq++;
  sys.hitSeq++;
  sys.emphasisSeq++;
  sys.killSeq += 3;
  sys.damageSeq++;
  sys.emit();
  const f = frames.at(-1)!;
  assert.equal(f.hitSeq, 2);
  assert.equal(f.emphasisSeq, 1);
  assert.equal(f.killSeq, 3);
  assert.equal(f.damageSeq, 1);
});

test("announce() raises the banner, bumps its seq, fires the cue, and emits", () => {
  const { sys, frames, announced } = makeSystem();
  sys.announce("WAVE 2");
  assert.deepEqual(announced, ["WAVE 2"]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.banner, "WAVE 2");
  assert.equal(frames[0]!.bannerSeq, 1);

  sys.announce("BREACH-BOSS");
  assert.equal(frames[1]!.banner, "BREACH-BOSS");
  assert.equal(frames[1]!.bannerSeq, 2); // strictly monotonic
});

test("clearBanner() drops a stale banner so VICTORY/DEFEAT can't re-flash", () => {
  const { sys, frames } = makeSystem();
  sys.announce("VICTORY");
  sys.clearBanner();
  sys.emit();
  const f = frames.at(-1)!;
  assert.equal(f.banner, "");
  assert.equal(f.bannerSeq, 0);
});

test("showToast() raises a pickup toast, bumps its seq, and emits", () => {
  const { sys, frames } = makeSystem();
  sys.showToast("+ SHOTGUN");
  sys.showToast("+35 HP");
  assert.equal(frames.length, 2);
  assert.equal(frames[1]!.toast, "+35 HP");
  assert.equal(frames[1]!.toastSeq, 2);
});

test("addDamageNumber projects a world point to screen-percent and rounds the amount", () => {
  const { sys, frames } = makeSystem();
  sys.addDamageNumber(new Vector3(0, 0, -5), 12.6, "crit");
  sys.emit();
  const [d] = frames.at(-1)!.damageNumbers;
  assert.ok(d, "a float was spawned for an on-screen hit");
  // (0,0,-5) is dead-centre of the viewport.
  assert.ok(Math.abs(d.x - 50) < 1e-6, `x≈50, got ${d.x}`);
  assert.ok(Math.abs(d.y - 50) < 1e-6, `y≈50, got ${d.y}`);
  assert.equal(d.amount, 13); // rounded
  assert.equal(d.kind, "crit");
  assert.equal(d.id, 1);
});

test("addDamageNumber clamps the floor of the amount to 1", () => {
  const { sys, frames } = makeSystem();
  sys.addDamageNumber(new Vector3(0, 0, -5), 0.2, "normal");
  sys.emit();
  assert.equal(frames.at(-1)!.damageNumbers[0]!.amount, 1);
});

test("addDamageNumber skips a hit behind the camera", () => {
  const { sys, frames } = makeSystem();
  sys.addDamageNumber(new Vector3(0, 0, 5), 10, "normal"); // behind the lens
  sys.emit();
  assert.deepEqual(frames.at(-1)!.damageNumbers, []);
});

test("addDamageNumber caps the live float pool at MAX_FLOATS (oldest dropped)", () => {
  const { sys, frames } = makeSystem();
  const overflow = HudCoreSystem.MAX_FLOATS + 5;
  for (let i = 0; i < overflow; i++) sys.addDamageNumber(new Vector3(0, 0, -5), i + 1, "normal");
  sys.emit();
  const nums = frames.at(-1)!.damageNumbers;
  assert.equal(nums.length, HudCoreSystem.MAX_FLOATS);
  // The first few ids were shifted off the front; the newest survives.
  assert.equal(nums[0]!.id, overflow - HudCoreSystem.MAX_FLOATS + 1);
  assert.equal(nums.at(-1)!.id, overflow);
});

test("emit() prunes floats once they outlive DAMAGE_NUMBER_TTL", () => {
  const { sys, host, frames } = makeSystem();
  sys.addDamageNumber(new Vector3(0, 0, -5), 5, "normal");
  sys.emit();
  assert.equal(frames.at(-1)!.damageNumbers.length, 1);

  host.time = HudCoreSystem.DAMAGE_NUMBER_TTL + 0.01; // float has now expired
  sys.emit();
  assert.deepEqual(frames.at(-1)!.damageNumbers, []);
});

test("a disposed host swallows the frame (no late push after teardown)", () => {
  const { sys, host, frames } = makeSystem();
  host.disposed = true;
  sys.emit();
  sys.announce("DEFEAT");
  sys.showToast("+ AMMO");
  assert.equal(frames.length, 0);
});

test("onAnnounce is optional — announce() still emits without a cue handler", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  camera.updateMatrixWorld(true);
  const host: HudHost = { camera, time: 0, disposed: false };
  const frames: HudCore<DemoExt>[] = [];
  const extension: HudExtension<DemoExt> = {
    vitals: () => ({ playerHealth: 1, maxPlayerHealth: 1 }),
    read: () => ({ status: "gameover", ammo: 0 }),
    // no onAnnounce
  };
  const sys = new HudCoreSystem<DemoExt>(host, extension, (f) => frames.push(f));
  sys.announce("DEFEAT");
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.banner, "DEFEAT");
  assert.equal(frames[0]!.status, "gameover");
});
