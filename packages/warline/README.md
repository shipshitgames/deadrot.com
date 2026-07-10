# @shipshitgames/warline

The pure, dependency-free core of **Warline — War for the Lanes**, the persistent
strategy hub that links every Ship Shit Game into one shared planet front.

`ARCHITECTURE.md` in this folder is the single source of truth for every type,
signature, constant, the map data, and the HTTP/WS protocol. This package is the
implementation of §1–§9 and §11.

## The War-for-the-Lanes model

One shared planet, three factions, four resources, one living world.

- **Regions** are held by a `Faction` (`pyre` | `wardens` under The Pact, vs the
  `scourge`, plus `neutral`). Each has `pressure` (Scourge corruption 0..100) and
  `defense` (fortification 0..100).
- **Breaches** sit in Scourge regions and pump pressure every tick.
- **Lanes** connect regions; their `flow` spreads pressure from hotter to cooler
  endpoints (Scourge-held lanes flow harder).
- The **Scourge presses every tick**: breaches pump, pressure spreads along lanes,
  and human regions can **fall** (`pressure >= 100`). Quiet Scourge regions next to
  human land can **recede** to neutral. Territory flips both ways.
- The authoritative world moves through authenticated, bounded **operation
  reports** from server-side reporters. The browser command table is an isolated
  local sandbox; anonymous commands never mutate the shared front.

Everything is **pure + immutable**: reducers clone the input `WorldState`, never
read the clock (callers pass `now`), and clamp pressure/defense/intensity/flow to
`[0, 100]`. The same reducers run authoritatively on the edge server and locally in
the browser (standalone demo mode).

## game → meta contract

Each game maps to exactly one `OperationKind` (`operationKindFor(game)` /
`GAME_OPERATIONS[game]`). On victory:

| game | kind | default target | effect | credits |
|------|------|----------------|--------|---------|
| scourge-survivors | `purge-breach` | hottest active breach | intensity −22·m, region pressure −14·m; seal at ≤0 (active=false, intel +120) | biomass +60·m, intel +25·m |
| deadlane | `hold-lane` | highest-flow lane bordering a human region | flow −20·m; human endpoints defense +8·m | scrap +70·m, fuel +20·m |
| pactfall | `contest-territory` | neutral region adjacent to faction | flip region → faction | intel +50·m |
| starblight | `orbital-intercept` | global | every active breach −8·m; hottest region −18·m | fuel +55·m, intel +15·m |
| redline | `run-logistics` | global | pactArmy +6·m | scrap +90·m, fuel +70·m |
| rothulk | `sabotage` | hottest active breach | intensity −30·m; sabotaged +4; region defense +4·m | biomass +50·m |

`m` is the magnitude (victory ~0.6..1.4, defeat ~0.2). Defeats are mild: a small
intel trickle (+8) and a minor/negative tactical nudge — a loss never wrecks the
front.

## Shared war-effort pool (#280)

On top of the operation effects above, every game can also bank a **looted war
resource** into the shared pool, and that pool powers a **global damage bonus**
that every game reads back. This is the cross-game progression layer: one
player's grind in Scourge Survivors makes everyone's shots hit harder.

- **Contribution.** An `OperationResult` may carry `contributed?: number` — the
  war-resource units the player looted that run. The reducer clamps it to
  `[0, MAX_CONTRIBUTION]` and banks it into the game's **primary** resource
  (`WAR_RESOURCE[game]` / `warResourceFor(game)`, i.e. `GAME_OPERATIONS[game].resources[0]`),
  **credited regardless of win/loss** — you keep what you collected. Banking
  shows up as a transparent `… salvage banked` line in the result breakdown.

  | game | banks into |
  |------|------------|
  | scourge-survivors, rothulk | `biomass` |
  | deadlane, redline | `scrap` |
  | pactfall, brawl | `intel` |
  | starblight | `fuel` |

- **Bonus.** `warEffortBonus(state)` derives the shared buff purely from the
  pooled resources (`warEffortPool` = the sum of all four resource bags, floored
  at 0). It returns `{ total, tier, damageMult, progress }`:
  `tier = floor(total / WAR_EFFORT.unitPerTier)` capped at `WAR_EFFORT.maxTier`;
  `damageMult = 1 + tier × WAR_EFFORT.perTier`; `progress` is the `[0, 1]`
  fraction toward the next tier. An empty pool is `NEUTRAL_WAR_EFFORT`
  (`damageMult: 1`). Current tuning: `unitPerTier: 5000`, `perTier: 0.04` (+4%
  damage/tier), `maxTier: 10` (so the buff saturates at +40%).

A browser game **submits** its run claim through
`reportWarlineOperation(slug, { …, contributed })` to the same-origin authenticated
broker and **reads** the public live buff through `fetchWarEffortBonus()`, both from
`@deadrot/game-kit/warline`. Both are offline-graceful: a rejected report never
blocks the run, and a missing/unreachable read returns `NEUTRAL_WAR_EFFORT`. See that package's
`warline/README.md` for the consumer-facing contract and the privacy/security stance.

## How it's consumed

- **Server** (`apps/games/warline/party`) imports `@shipshitgames/warline` (this barrel only —
  never `./client`). It holds one `WorldState`, runs `tick(state, Date.now())` on an
  alarm, applies `applyOperation` only for authenticated server reporters, and
  broadcasts read-only state over WS. It rejects anonymous WS/HTTP mutations.
- **Hub** (`apps/games/warline/src`) connects with `connectWarline()` from
  `@shipshitgames/warline/client` and mirrors server state; if no server is reachable it
  seeds `createInitialWorld()` and runs the identical reducers locally.
- **Games** submit run claims through `reportWarlineOperation()` from
  `@deadrot/game-kit/warline`, called once per run beside each game's
  `recordWarResult(...)`. The browser helper carries no secret and posts to the
  same-origin broker. That server authenticates the player, checks game access,
  derives the subject, and forwards with a server-only reporter credential.
  PartyKit enforces strict fields, game authorization, score/contribution caps,
  rate limits, timestamps, and durable nonce receipts. Client gameplay remains a
  bounded claim rather than cheat-proof evidence.

The pure core (`@shipshitgames/warline`) has **no runtime dependencies**. Only the
`@shipshitgames/warline/client` subpath imports `partysocket`, keeping the core safe to
import on the edge server.

## API surface

- Types & constants — §1/§2: `WorldState`, `Region`, `Lane`, `Breach`, `WarEvent`,
  `OperationResult`, `Command`, `Summary`, `SCHEMA_VERSION`, `FEED_MAX`, `TICK_MS`,
  `TICK`, `ECON`, `COMMAND_COSTS`, `COMMAND_EFFECT`, …
- Map — `createInitialWorld`, `regionById`, `laneById`, `breachById`, `neighborsOf`,
  `clamp`.
- Operations — `GAME_OPERATIONS`, `operationKindFor`, `warResourceFor`, `WAR_RESOURCE`.
- War effort (#280) — `warEffortPool`, `warEffortBonus`, `NEUTRAL_WAR_EFFORT`,
  `WarEffortBonus`, plus `WAR_EFFORT` / `MAX_CONTRIBUTION` constants and the
  `OperationResult.contributed` field.
- Reducer — `applyOperation`, `tick`, `resetWorld`, `makeEventId`, `magnitude`,
  `clampContribution`.
- Commands — `canAfford`, `applyCommand`.
- Summary — `summarize`.
- Client (`@shipshitgames/warline/client`) — `WarlineClient`, `connectWarline`,
  `warlineUrl`.

## Tests

```sh
bun run test   # node --test, pure (no network)
```
