/**
 * @shipshitgames/warline — narrative war events (spec §5 extension).
 *
 * Scripted story beats that fire from the world simulation itself, so the
 * front feels alive between player operations. Selection is DETERMINISTIC:
 * seeded by (epoch, tick), so every client and the authoritative server pick
 * the same event for the same world — multiplayer stays pure/replayable.
 *
 * Each event carries a `timelineRef` naming a slug in the canon timeline
 * (@shipshitgames/assets/lore timeline-events). The package stays
 * dependency-free per its edge-safe doctrine: refs are strings here, and the
 * Warline app's unit tests pin them against the lore data.
 */

import type { WarEvent, WorldState } from "./types";
import { FEED_MAX } from "./types";

export const NARRATIVE = {
  /** A story beat may fire only every Nth tick (15s ticks → every ~3 min). */
  cadenceTicks: 12,
  /** Chance a beat fires on an eligible tick (rolled deterministically). */
  chance: 0.6,
} as const;

export interface NarrativeEventDef {
  slug: string;
  /** Canon anchor: slug in @shipshitgames/assets/lore timeline-events. */
  timelineRef: string;
  weight: number;
  /** Pure predicate: may this beat fire on this world? */
  trigger: (state: WorldState) => boolean;
  /**
   * Mutate the (already-cloned) world and return the feed text. Effects must
   * be small nudges — the reducer clamps after.
   */
  apply: (state: WorldState) => string;
}

function isHuman(faction: string): boolean {
  return faction === "pyre" || faction === "wardens";
}

function humanRegions(state: WorldState) {
  return state.regions.filter((r) => isHuman(r.faction));
}

function meanHumanPressure(state: WorldState): number {
  const regions = humanRegions(state);
  if (regions.length === 0) return 0;
  return regions.reduce((sum, r) => sum + r.pressure, 0) / regions.length;
}

export const NARRATIVE_EVENTS: NarrativeEventDef[] = [
  {
    slug: "breach-stirs",
    timelineRef: "the-lanes-go-dark",
    weight: 3,
    trigger: (s) => s.breaches.some((b) => b.active && b.intensity > 80),
    apply: (s) => {
      const breach = s.breaches.filter((b) => b.active).sort((a, b) => b.intensity - a.intensity)[0];
      if (!breach) return "The Choir stirs.";
      const region = s.regions.find((r) => r.id === breach.regionId);
      if (region) region.pressure += 6;
      return `The Choir masses at ${breach.name}. Pressure climbs around it.`;
    },
  },
  {
    slug: "repeater-fragmented",
    timelineRef: "the-repeater-secret",
    weight: 2,
    trigger: (s) => s.tick > 6 && meanHumanPressure(s) < 40,
    apply: (s) => {
      s.resources.intel += 30;
      return "Signals crews fragment a repeater cluster — the local swarm goes feral. Intel recovered.";
    },
  },
  {
    slug: "convoy-through",
    timelineRef: "the-ninety-second-window",
    weight: 3,
    trigger: (s) => humanRegions(s).length >= 4,
    apply: (s) => {
      s.resources.scrap += 40;
      s.resources.fuel += 20;
      return "A courier threads the Switchback inside the ninety-second window. The convoy behind her makes it.";
    },
  },
  {
    slug: "wells-surge",
    timelineRef: "the-wells-go-pact",
    weight: 2,
    trigger: (s) => humanRegions(s).some((r) => r.defense > 50),
    apply: (s) => {
      const weakest = humanRegions(s).sort((a, b) => a.defense - b.defense)[0];
      if (weakest) weakest.defense += 10;
      return `The Cinder Wells surge — spare current shores up ${weakest?.name ?? "the line"}.`;
    },
  },
  {
    slug: "choir-counterattack",
    timelineRef: "zero-day-landfall",
    weight: 3,
    trigger: (s) => meanHumanPressure(s) > 45,
    apply: (s) => {
      const targets = humanRegions(s)
        .sort((a, b) => b.pressure - a.pressure)
        .slice(0, 2);
      for (const r of targets) r.pressure += 7;
      return "The Choir answers in kind. Coordinated pushes land on the hottest stretches of the line.";
    },
  },
  {
    slug: "listener-whisper",
    timelineRef: "the-listeners-emerge",
    weight: 1,
    trigger: (s) => s.resources.intel > 180 && s.regions.some((r) => !r.revealed),
    apply: (s) => {
      const hidden = s.regions.find((r) => !r.revealed);
      s.resources.intel = Math.max(0, s.resources.intel - 50);
      if (hidden) hidden.revealed = true;
      return `A Listener cell sells a map nobody should have. ${hidden?.name ?? "A dark sector"} is revealed.`;
    },
  },
  {
    slug: "pact-rally",
    timelineRef: "the-pact-sworn",
    weight: 2,
    trigger: (s) => s.feed.slice(0, 10).some((e) => e.kind === "fall"),
    apply: (s) => {
      s.pactArmy += 15;
      return "A holdout fell — and the feud goes quiet. Pyre and Warden columns muster under the Pact.";
    },
  },
  {
    slug: "quiet-lane",
    timelineRef: "the-partial-sever",
    weight: 2,
    trigger: (s) => s.feed.slice(0, 10).some((e) => e.sealed === true),
    apply: (s) => {
      for (const r of humanRegions(s)) r.pressure = Math.max(0, r.pressure - 4);
      return "The sealed breach holds. For one shift the lanes stay quiet, and the line breathes.";
    },
  },
];

/** Deterministic mulberry32 (inlined to keep this package dependency-free). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The deterministic seed for a world's narrative roll this tick. */
export function narrativeSeed(state: WorldState): number {
  return (state.epoch * 7919 + state.tick) >>> 0;
}

/**
 * Pick the narrative beat for this tick, or null. Pure — same world in, same
 * choice out. The reducer applies the returned def to the cloned state.
 */
export function pickNarrativeEvent(state: WorldState): NarrativeEventDef | null {
  if (state.tick === 0 || state.tick % NARRATIVE.cadenceTicks !== 0) return null;
  const next = rng(narrativeSeed(state));
  if (next() > NARRATIVE.chance) return null;

  const eligible = NARRATIVE_EVENTS.filter((def) => def.trigger(state));
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, def) => sum + def.weight, 0);
  let roll = next() * totalWeight;
  for (const def of eligible) {
    roll -= def.weight;
    if (roll <= 0) return def;
  }
  return eligible[eligible.length - 1] ?? null;
}

/**
 * Fire this tick's narrative beat (if any) against an already-cloned world.
 * Mutates `state` in place and pushes the story feed event. Returns the event
 * or null. Called by the reducer inside tick().
 */
export function applyNarrative(state: WorldState, now: number): WarEvent | null {
  const def = pickNarrativeEvent(state);
  if (!def) return null;

  const text = def.apply(state);
  const event: WarEvent = {
    id: `n${state.tick}-${state.epoch}-${now}`,
    t: state.tick,
    at: now,
    kind: "story",
    faction: "neutral",
    text,
    detail: `war record: ${def.timelineRef}`,
  };
  state.feed.unshift(event);
  if (state.feed.length > FEED_MAX) state.feed.length = FEED_MAX;
  return event;
}
