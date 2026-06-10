# Vendored Quartz Patches

## Upstream

- Vendored upstream: **Quartz v4.5.2** from
  [jackyzha0/quartz](https://github.com/jackyzha0/quartz)
- Imported in repo commit `09f346f` ("feat: publish the lore vault at
  apps/lore (Quartz v4)").
- Everything under `quartz/`, plus `globals.d.ts` and `index.d.ts`, is upstream
  code. Do not refactor or reformat it (see `.prettierignore`) — keeping it
  byte-identical to upstream makes future upgrades a mechanical diff/replace.

## Local functional changes

1. `quartz/plugins/emitters/ogImage.tsx` — the satori call casts the JSX node:
   `imageComponent as unknown as Parameters<typeof satori>[0]`. This works
   around a satori/preact JSX type mismatch (satori expects React JSX types;
   this project renders with preact). Re-apply (or drop, if upstream/satori
   types align) on the next upgrade.

That is the only intentional patch to the vendored tree.
