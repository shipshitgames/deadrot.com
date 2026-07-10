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

Both are **offline-graceful**. Reports go to the same-origin authenticated
broker and public reads use the configured PartyKit host; a rejection, missing
route, dead server, or slow read can never throw into, block, or delay gameplay.

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
| `configureWarlineReporter(cfg)` | Set public `{ host, reportEndpoint }` configuration at app bootstrap. |
| `resolveWarlineConfig(opts?)` | Inspect effective public configuration (precedence below). |
| `readSharedFaction()` | The allegiance the player picked in the hub (`"wardens"` default). |
| `WarlineRunInput`, `WarEffortBonus`, `WarlineReportClient`, `WarlineStateClient`, … | Types. |

### Config resolution (highest priority first)

1. explicit per-call `opts` (`{ host, reportEndpoint, client }`)
2. `configureWarlineReporter({ host, reportEndpoint })` (process-wide)
3. `globalThis.__warlineReporter` (runtime override — handy for tests/e2e)
4. public build env: `VITE_WARLINE_HOST` / `VITE_WARLINE_REPORT_ENDPOINT`

A missing/whitespace-only host disables the public buff read. The report
endpoint defaults to same-origin `/api/warline/report`; set it to an empty string
to disable submission. Inject a `client` to unit-test without a network.

---

## Privacy & security expectations

Reporting a contribution sends data to a **shared, server-authoritative** front.
Be explicit about what that means:

- **What leaves the device.** The broker receives the `OperationResult`: game,
  faction, outcome, numeric score, optional contribution, and a generated/provided
  nonce. Games should not set PII. The broker strips `player` and `targetId` before
  forwarding.
- **No browser secret.** This module sends no bearer credential. In particular,
  `VITE_WARLINE_TOKEN` is not supported: every Vite value is public bundle data.
- **The server is the trust boundary.** The same-origin broker establishes the
  signed-in subject and game access, then calls PartyKit with a server-only reporter
  identity. PartyKit fails closed without reporter/admin secrets, authorizes games,
  validates an exact operation shape, caps score/contribution, rate-limits per
  subject, rejects stale/conflicting replays, and returns durable receipts for exact
  retries. Client gameplay is still a bounded claim, not cheat-proof evidence.
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
