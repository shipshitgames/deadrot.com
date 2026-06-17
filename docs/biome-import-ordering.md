# Biome import ordering

Imports and exports are ordered by Biome's `organizeImports` assist, and that
order is **enforced in CI** on every PR. This resolves issue #54.

## How it's enforced

`organizeImports` is an [assist action](https://biomejs.dev/assist/), not a lint
rule, so `biome lint` alone never checks it. Enforcement therefore runs through
`biome check`, which bundles the formatter, linter, **and** assist:

- `package.json` → the `ci` script runs `bun run check` (`biome check .`).
- `.github/workflows/ci.yml` → the "Lint, format, typecheck, assets" job runs
  `bun run check`.

`biome check` exits non-zero when a file's imports are not organized, so an
unordered import fails the PR gate. Run `bun run check:fix` locally to apply the
ordering before pushing.

## Curated barrels (exempt)

A handful of package entry barrels are **hand-curated**: their exports are
grouped by concern (and, for `warline`, annotated with spec-section comments)
rather than sorted alphabetically. Alphabetizing them would scramble a
deliberately readable structure, so `organizeImports` is turned **off** for them
via an override in `biome.json`:

```jsonc
"overrides": [
  {
    "includes": ["**/packages/*/src/index.ts"],
    "assist": { "actions": { "source": { "organizeImports": "off" } } }
  }
]
```

The exempt barrels are every top-level package entry point:

| Barrel                          | Why it's curated                                     |
| ------------------------------- | ---------------------------------------------------- |
| `packages/assets/src/index.ts`  | Doc-header + logical entity / shared grouping        |
| `packages/game-kit/src/index.ts`| Re-export barrel for the runtime sub-modules         |
| `packages/ui/src/index.ts`      | Grouped by component cluster, not strict alphabetical |
| `packages/warline/src/index.ts` | Grouped with `// spec §…` section comments           |

Everything else in the repo — including nested barrels such as
`packages/game-kit/src/<area>/index.ts` — is organized normally.

## Adding or removing a curated barrel

The override glob (`**/packages/*/src/index.ts`) matches **only** the top-level
`src/index.ts` of each package. If you add a new package whose entry barrel needs
hand-curated ordering, it is already covered. If you want a *non*-`index.ts`
file or a nested barrel exempted, add its path to the override's `includes`
array and note it here.

If a barrel no longer needs manual ordering, drop it from the table, run
`bun run check:fix` to alphabetize it, and tighten the override glob if it should
no longer be exempt.

The regression test in `e2e/biome-import-ordering.test.ts` verifies both halves
of this policy: the gate flags unorganized non-barrel files, and the override
exempts `packages/*/src/index.ts`.
