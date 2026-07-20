# Dual held-weapon tier sheets

These runtime WebP sheets promote purpose-built dual-wield redraws made from
the approved Pyre first-person weapon tier sheets. Each authored cell contains
one independently drawn weapon and hand on each side with uncrossed barrels.

The original imagegen PNGs are preserved under
`packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-07-17/raw/019f6f5c-bac3-7ac0-8881-c7cb86fe01e7/`.
The generator removes their baked checkerboard, normalizes five equal cells,
and encodes runtime alpha WebP.

Generate or verify the committed outputs:

```sh
node packages/assets/scripts/generate-scourge-dual-weapons.mjs
node packages/assets/scripts/generate-scourge-dual-weapons.mjs --check
```

The cannon is intentionally excluded because its weapon definition is not
dual-compatible.
