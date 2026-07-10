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

## License

MIT (code). Assets follow the studio style/lore canon.
