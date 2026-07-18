# Scourge Survivors

First-person **horde-survivors** shooter — Vampire-Survivors × DOOM. A lone **Pyre** operator
drops into a breach and must survive **the Scourge**: endless, growing swarms, in first person,
with auto-scaling weapons, a level-up draft, and DOOM-fast gore.

Part of the **Ship Shit Games** universe — built and streamed live on the **shipshitshow**
YouTube channel.

- **Universe / canon:** [apps/lore/content](../../lore/content)
- **Built with:** Vite + TypeScript + imperative Three.js + PartyKit, on the `@shipshitgames/engine` conventions
- **Faction:** the Pyre · **Enemy:** the Scourge · **Deepest zone:** Perdition
- **Runtime art format:** WebP, per the shared [asset-format policy](../../../packages/assets/docs/asset-format-policy.md) — this game is its reference migration

## Dev

```bash
bun install
bun run dev:all   # game (Vite) + PvP preview rooms (PartyKit)
```

See [DEPLOY.md](./DEPLOY.md) for the monorepo hub + PartyKit deploy.

## Status

Active game project focused on the Survivors core. Campaign content becomes a "structured run"
and the game expands with more maps.

The first menu is the Survivors hub: Play a Run, Shop, PvP Arena, and Leaderboard, with
`Game.startSurvivors()` as the primary PvE entrypoint.

The networked mode is currently an **unauthenticated PvP Arena Preview**, not co-op:
PvE waves are suspended, clients propose movement and hit claims, and PartyKit owns the
accepted transforms, health, frag credit, and respawns. It is not positioned as a
competitive anti-cheat service. Genuine drop-in co-op Survivors requires shared,
server-owned run/wave state and remains tracked in
[#74](https://github.com/shipshitgames/deadrot.com/issues/74).

The permanent gold-shop economy (income, costs, and the one-run-can't-buy-everything
invariant) is tuned and documented in [ECONOMY.md](./ECONOMY.md).

## Balance telemetry

Survivors runs emit the shared `deadrot.balance.v1` event schema for progression,
draft decisions, enemy pressure, damage, boss phases, and run outcomes. Browser
events are buffered under `deadrot:balance-telemetry:v1`; inspect them locally with:

```js
JSON.parse(localStorage.getItem("deadrot:balance-telemetry:v1") ?? "[]")
```

When configured, the same events are sent to PostHog as
`deadrot_balance_<event-name>`. Sentry receives the `run_end` and `boss_phase`
events as `game.balance` breadcrumbs. Sampling, local buffering, release tags,
and sink credentials remain controlled by the existing `VITE_BALANCE_TELEMETRY_*`,
`VITE_POSTHOG_*`, and `VITE_SENTRY_*` environment settings.

## License

MIT (code). Assets follow the studio style/lore canon.
