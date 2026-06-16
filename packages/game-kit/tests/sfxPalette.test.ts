import assert from "node:assert/strict";
import { test } from "node:test";

import { DEADROT_SFX_PALETTE, type Synth } from "../src/audio/sfxPalette";

// The palette is pure logic: each cue is a function over an injected Synth, with
// no Web Audio at module load. A recording mock lets us exercise every cue
// headlessly and pin what each one actually asks the synth to do.

type Kind = "zap" | "noise" | "chord";

function recorder(): { synth: Synth; kinds: Kind[]; zaps: number[][] } {
  const kinds: Kind[] = [];
  const zaps: number[][] = [];
  const synth: Synth = {
    zap(t, _type, f0, f1, dur, gain) {
      kinds.push("zap");
      zaps.push([t, f0, f1, dur, gain]);
    },
    noise(_t, _dur, _gain, _filterFreq) {
      kinds.push("noise");
    },
    chord(_t, _freqs, _dur) {
      kinds.push("chord");
    },
  };
  return { synth, kinds, zaps };
}

test("every cue plays at least one primitive and uses only zap/noise/chord", () => {
  const known: Kind[] = ["zap", "noise", "chord"];
  for (const [name, cue] of Object.entries(DEADROT_SFX_PALETTE)) {
    const { synth, kinds } = recorder();
    assert.doesNotThrow(() => cue(synth, 0, 1), `${name} cue runs headlessly`);
    assert.ok(kinds.length > 0, `${name} emits at least one primitive`);
    for (const k of kinds) {
      assert.ok(known.includes(k), `${name} only uses known primitives (saw ${k})`);
    }
  }
});

test("victory is a chord fanfare; explosion layers zap booms and noise", () => {
  const v = recorder();
  DEADROT_SFX_PALETTE.victory(v.synth, 0, 1);
  assert.ok(v.kinds.includes("chord"), "victory uses the chord primitive");

  const e = recorder();
  DEADROT_SFX_PALETTE.explosion(e.synth, 0, 1);
  assert.ok(e.kinds.includes("zap"), "explosion uses zap");
  assert.ok(e.kinds.includes("noise"), "explosion uses noise");
});

test("the pitch scalar threads through to the synth frequency", () => {
  const base = recorder();
  DEADROT_SFX_PALETTE.shootSniper(base.synth, 0, 1);
  const scaled = recorder();
  DEADROT_SFX_PALETTE.shootSniper(scaled.synth, 0, 2);
  // sniper f0 = 260 * p — doubling p must double the first oscillator's start freq.
  assert.equal(base.zaps[0]![1], 260, "p=1 leaves the base frequency");
  assert.equal(scaled.zaps[0]![1], 520, "p=2 scales the frequency");
});

test("palette exposes the documented cross-game seed cues with no duplicates", () => {
  const ids = Object.keys(DEADROT_SFX_PALETTE);
  assert.equal(new Set(ids).size, ids.length, "no duplicate cue ids");
  // Seeds named in the file header (jump/land → Rothulk, build → Deadlane,
  // laser/powerup → Starblight) plus the core shooter cues must be present.
  for (const id of ["shoot", "victory", "breach", "jump", "land", "build", "laser", "powerup"]) {
    assert.ok(ids.includes(id), `${id} cue present`);
  }
});
