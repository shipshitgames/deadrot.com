# `@deadrot/game-kit/warline` — cross-game Warline reporting

This subpath is the **one gateway** every Ship Shit Game uses to talk to the
shared *War for the Lanes* front. It is quarantined on its own export path
(mirroring `@shipshitgames/warline/client`) so the `partysocket`-touching client
never leaks into the main game-kit barrel.

It does two things:

1. **Report** a finished run's result — including any **looted war resource** —
   into the shared front (`reportWarlineOperation`).
2. **Read** the shared **war-effort buff** the pooled resources unlock, so a run
   can scale itself by the collective effort (`fetchWarEffortBonus`).

Both are **config-gated** and **offline-graceful**: with no host configured the
report is a silent no-op and the read returns the neutral 1× bonus. A
dead/unreachable/slow front can never throw into, block, or delay your game loop.

---

## Quick start (the #280 contract)

Add **two** call sites to a game. That's the whole integration.

### 1. Read the shared buff at run start

```ts
import { fetchWarEffortBonus } from "@deadrot/game-kit/warline";

// Once, when a run begins. Never throws; resolves to NEUTRAL_WAR_EFFORT
// (damageMult: 1) when the front is disabled or unreachable.
const bonus = await fetchWarEffortBonus();
applyDamageMultiplier(bonus.damageMult); // 1.0 .. 1.4 — the global war-effort buff
```

`bonus` is a `WarEffortBonus`: `{ total, tier, damageMult, progress }`. `tier` is
how many full pool-tiers the shared war has banked; `damageMult` is the buff to
multiply your outgoing damage by; `progress` is the `[0, 1]` fraction toward the
next tier (good for a HUD bar). See `@shipshitgames/warline`'s `README.md` for the
exact tier math and tuning.

### 2. Report the run — and bank what was looted — at run end

```ts
import { reportWarlineOperation } from "@deadrot/game-kit/warline";

// Once per run, beside your existing recordWarResult(...) site. Fire-and-forget.
void reportWarlineOperation("scourge-survivors", {
  outcome: didWin ? "victory" : "defeat",
  score: finalScore,
  contributed: lootedWarResource, // #280: war-resource units banked into the shared pool
});
```

`contributed` is the magnitude of the war resource the player looted this run.
The server clamps it to `[0, MAX_CONTRIBUTION]` and banks it into **your game's
primary resource** (`WAR_RESOURCE[slug]` in `@shipshitgames/warline` — e.g.
`scourge-survivors → biomass`, `deadlane → scrap`), **regardless of win or loss**
— the player keeps what they collected. Omit it (or pass `0`) to bank nothing.

> **Design note (Scourge reference impl).** Scourge derives `contributed` from
> end-of-run stats via a pure `runBiomass(kills, level, time)` (capped well below
> one pool-tier so no single run can swing the global war), rather than tracking
> per-pickup sprite state. Other games are free to count literal pickups instead;
> the wire contract is just "a non-negative number of looted units."

---

## API

| export | purpose |
|--------|---------|
| `reportWarlineOperation(slug, run, opts?)` | Build + send an `OperationResult`. Resolves to `{ reported, status, result, error? }`; never rejects. |
| `fetchWarEffortBonus(opts?)` | Read the shared buff. Resolves to a `WarEffortBonus`; never rejects. |
| `buildOperationResult(slug, run)` | Pure builder (faction default, score/`contributed` clamp). Unit-test your mapping with no network. |
| `configureWarlineReporter(cfg)` | Set the process-wide `{ host, token }` once at app bootstrap. |
| `resolveWarlineConfig(opts?)` | Inspect the effective `{ host, token }` (precedence below). |
| `readSharedFaction()` | The allegiance the player picked in the hub (`"wardens"` default). |
| `WarlineRunInput`, `WarEffortBonus`, `WarlineReportClient`, `WarlineStateClient`, … | Types. |

### Config resolution (highest priority first)

1. explicit per-call `opts` (`{ host, token, client }`)
2. `configureWarlineReporter({ host, token })` (process-wide)
3. `globalThis.__warlineReporter` (runtime override — handy for tests/e2e)
4. build env: `VITE_WARLINE_HOST` / `VITE_WARLINE_TOKEN`

A missing/whitespace-only host reads as **disabled** (no request). Inject a
`client` (a `WarlineReportClient` for reporting, or a `WarlineStateClient` for
reading) to unit-test without a network — see `tests/warlineReporter.test.ts`.

---

## Privacy & security expectations

Reporting a contribution sends data to a **shared, server-authoritative** front.
Be explicit about what that means:

- **What leaves the device.** Only the `OperationResult`: game slug, faction,
  outcome, numeric `score`, optional `contributed`, and the **optional** fields a
  game chooses to set — `player` (a handle), `nonce` (idempotency), `targetId`.
  No device identifiers, telemetry, or PII are added by this module. **Do not put
  PII in `player`** — treat it as a public, world-visible handle.
- **Opt-in by configuration.** Reporting only happens when a host is configured.
  Single-game / local builds ship with no host and therefore **never touch the
  network**. There is no hidden default endpoint.
- **The server is the trust boundary.** Game reports authenticate with a
  **bearer token** (`WARLINE_TOKEN`) **when the front is configured with one** —
  if `WARLINE_TOKEN` is unset the server is dev-permissive and accepts any report
  (so production fronts must set it); resets always need an admin token. The client
  only ever holds whatever token the build is given. Regardless of auth, the server
  **clamps and bounds the numbers it banks**: `contributed` → `[0, MAX_CONTRIBUTION]`
  (one war-effort tier per report), and the per-entity world scalars (region
  pressure/defense, breach intensity, lane flow) → `[0, 100]`. The shared resource
  *pool* is intentionally unbounded above — that's what lets the war effort climb —
  so the per-report cap, not a pool ceiling, is the grief bound. Treat client-supplied
  numbers as untrusted and never authoritative.
- **Shared, not personal, progression.** Contributions aggregate into one global
  pool; the buff is derived from that pool, not from any individual's identity.
  Nothing here is a per-user profile.
- **Graceful failure is a privacy feature too.** Because the call is
  fire-and-forget and swallows all errors, a blocked/region-restricted/offline
  player simply gets the neutral bonus — they are never singled out, retried at,
  or blocked from playing.

## Boundary note

This is deliberately separate from `@deadrot/game-kit/core`'s `recordWarResult`,
which is **display-only `localStorage`** and must never feed the shared
simulation. This module is the one path that *does* feed the shared front.
