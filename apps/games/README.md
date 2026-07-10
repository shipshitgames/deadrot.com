# Deadrot game configuration

Every Vite game extends `tsconfig.base.json` in this directory, which extends
the repository TypeScript base. Game-local configs keep only their source alias
and narrowly scoped legacy exemptions.

Every game build runs `tsc && vite build`. There are no build-script
exceptions: `typecheck` remains available for a faster type-only check.

## Three.js compatibility boundary

Scourge Survivors intentionally remains on Three `^0.169` and matching
`@types/three` while its multiplayer/render stack completes its compatibility
work. The other game surfaces use Three `0.184` / `@types/three` `0.184.1`.
`@deadrot/game-kit` supports either through its `three >=0.169.0` peer range.
Do not align these versions without validating the Scourge multiplayer flow and
the shared engine against the newer Three release.
