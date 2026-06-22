# Scourge Survivors — Meta-Progression Economy

The gold shop (`Survivors Upgrade Shop`) sells **permanent** upgrades that apply
to every future run. Gold is earned by finishing runs. This document records the
tuning targets so future changes stay intentional.

Source of truth for the numbers lives in
[`src/game/data/survivors.ts`](src/game/data/survivors.ts) — `runGold`,
`shopCost`, `RUN_GOLD_CAP`, and the `shop*Cost` / `shopTiersOwned` helpers. The
unit suite (`tests/unit/economy.test.ts`) asserts the invariants below against
those functions directly, so the doc and the code cannot silently drift.

## Core invariant (#277)

> **A single run can never buy out the gold shop.**

Maxing every upgrade from scratch costs `shopTotalCost()` ≈ **4,300 gold**
(33 tiers across 10 upgrades). A single run's payout is hard-capped at
`RUN_GOLD_CAP = 1,500` — roughly **one third** of the full armory. Even an
impossibly good run therefore buys only a slice, and full progression is paced
across many runs.

## Income — `runGold(kills, level, time, greedTier)`

```
base    = kills * 0.9 + level * 5 + time * 0.4
gold    = min(RUN_GOLD_CAP, floor(base * (1 + 0.15 * greedTier)))
```

- **Kills, level, and survival time** all contribute, so both aggressive and
  defensive play earn.
- The **Salvage Tithe** (`greed`) shop upgrade adds +15% per tier (max +60%).
- `RUN_GOLD_CAP` (1,500) clamps the total so no outlier run can spike.

### Target payouts (assumptions)

| Run profile                     | kills | level | time | greed | gold  |
| ------------------------------- | ----: | ----: | ---: | ----: | ----: |
| Weak / early bail (~4 min)      |    60 |    10 | 240s |     0 |  ~200 |
| Typical run (~5 min)            |   120 |    15 | 300s |     0 |  ~303 |
| Typical run, greed maxed        |   120 |    15 | 300s |     4 |  ~484 |
| Strong full clear (~10 min)     |   400 |    35 | 600s |     0 |  ~775 |
| Strong clear, greed maxed       |   400 |    35 | 600s |     4 | ~1240 |
| Record run (over-cap)           |   900 |    55 | 600s |     4 |  1500 |

## Costs — `shopCost(def, tier)`

```
shopCost = round(baseCost * (1 + 0.8 * tier + 0.25 * tier²))
```

Cost escalates **quadratically** with tiers already owned, so the first tier is
cheap and impulse-friendly while the last tier of a five-tier upgrade is a real
long-term goal. Per-upgrade max costs:

| Upgrade                    | base | tiers | cost to max |
| -------------------------- | ---: | ----: | ----------: |
| Pyre Munitions (`might`)   |   35 |     5 |        ~718 |
| Ash-Hardened Suit (`vigor`)|   35 |     5 |        ~718 |
| Breach Sprint (`swift`)    |   45 |     4 |        ~553 |
| Field Cautery (`regenP`)   |   40 |     4 |        ~492 |
| Ichor Draw (`magnetP`)     |   30 |     4 |        ~369 |
| Breach Lessons (`scholar`) |   40 |     4 |        ~492 |
| Salvage Tithe (`greed`)    |   50 |     4 |        ~615 |
| Cautery Kit (`arsenal`)    |  120 |     1 |         120 |
| Ember Cache (`munitions`)  |  120 |     1 |         120 |
| Nova Core (`pulsar`)       |  140 |     1 |         140 |

## Pacing target (runs to complete)

At ~300 gold for a typical run, the full armory (~4,300 gold) takes roughly
**14 typical runs**; a player who farms strong 10-minute clears and invests in
`greed` early completes it in **~6–8 runs**. A single core upgrade tree
(`might`/`vigor` ≈ 718 gold) is ~2–3 strong runs of focused saving.

## UI contract

The shop screen still communicates state clearly:

- An **Armory N/33** progress line plus the remaining gold needed to fully
  upgrade (or "Fully upgraded" once complete).
- Each upgrade shows its current `tier/max`, the next-tier cost, and a buy
  button that is disabled when unaffordable or maxed (`MAX`).

## Save compatibility

The persisted `ShopState` shape — `localStorage["scourge-survivors.shop.v1"]`
with `{ gold, tiers }` — is unchanged, so existing saves load as-is. `loadShop`
now sanitizes `tiers` to clean non-negative integers so legacy/tampered values
cannot corrupt the escalating-cost math.
