# Runtime Asset Budgets

`packages/assets` owns the player-facing runtime asset budget gate. It measures
runtime files only: source custody folders such as `sources/`, `_archive/`, and
masters are intentionally excluded.

```bash
bun run --cwd packages/assets assets:budgets
bun run --cwd packages/assets assets:budgets --check
```

The report is per game and includes:

- runtime file count and total bytes;
- detectable initial/preload bytes (`ui/menu`, `ui/cover`, fonts, or manifest
  entries marked `preload`, `initial`, or `eager`);
- largest files;
- catalog / manifest / animation-pack coverage;
- forbidden runtime raster formats, with the documented `ui/social/og.jpg`
  exception.

The check is also part of both package and root asset gates:

```bash
bun run --cwd packages/assets assets:check
bun run assets:check
```

Budgets live in `packages/assets/asset-budgets.json`. Update them intentionally
when a game gains a real asset pack, not just because a file happened to grow:

1. Run `bun run --cwd packages/assets assets:budgets`.
2. Inspect the exact files listed under the affected game.
3. Compress, atlas, or move source material out of runtime paths when possible.
4. If the size is intentional, raise the relevant category or game budget in
   `asset-budgets.json` in the same PR and mention why.

Category defaults keep small arcade games tight while allowing larger 3D arena
and hub/meta packs. Per-game overrides may be added when a shipped game has a
specific release contract.

Scourge Survivors also has a production-browser gate for request counts and
decoded response bodies. Chromium can report an `HTMLMediaElement` resource as
zero bytes, a buffered range, or the whole media file depending on playback
timing. The gate therefore keeps `audio` and `video` initiators in request
counts and raw diagnostics, allowlists the expected track paths, and applies
the decoded-body ceiling to deterministic non-media resources. The package
gate above still enforces the shipped per-file ceiling for those tracks.
