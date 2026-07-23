# Generated asset custody policy

This is the canonical decision rule for generated source material, approved
masters, promoted runtime assets, review quarantine, and disposable caches in
the Deadrot asset package. The package audit enforces the runtime boundary.

## Decision matrix

| Decision | Put it here | Keep when | Runtime/manifests |
|---|---|---|---|
| Keep generated history | `packages/assets/sources/generated/<semantic path>/<YYYY-MM-DD>/...` | The generation was successful or explains an accepted/replaced asset, and the file has a semantic name plus useful prompt/provenance context | Never export, sync to the CDN, or reference from a manifest |
| Keep an approved master | `packages/assets/masters/<type>/<domain>/<asset-id>/...` | It is an approved high-quality source used to derive runtime output | Never reference directly from a runtime manifest |
| Promote runtime output | `packages/assets/games`, `entities`, `shared`, `brand`, `universe`, `concepts`, `lore`, or `models` | The asset is approved, optimized for its consumer, licensed, and named by stable game meaning | Required: manifests reference only these semantic runtime paths |
| Quarantine for review | `packages/assets/_archive/<batch>/...` | Raw provider output, rejected/banned-provider work, or untriaged material still has review or traceability value | Never export, sync, or reference from a manifest |
| Delete | Outside git after review | The file is a reproducible cache, duplicate, failed draft with no learning value, or sensitive/provider-temporary residue | Not applicable |

`packages/assets/_archive` is durable quarantine, not a second source library.
Review it deliberately: promote accepted history or masters, retain material
only while it has traceability value, and delete disposable residue.

## Promotion gate

Before a generated asset moves to a runtime root:

1. Confirm the content and visual direction are approved.
2. Confirm commercial-use/license metadata and provider provenance.
3. Reject xAI/Grok output from promoted manifests. Banned-provider material may
   remain only in quarantine while it has review value.
4. Preserve the useful source/prompt trail under `sources/generated` or the
   approved master under `masters`.
5. Optimize the runtime derivative (WebP for browser raster; the social
   `games/<slug>/ui/social/og.jpg` exception is documented separately).
6. Register only the semantic runtime path in catalogs/manifests.
7. Run `bun run --cwd packages/assets assets:check`.

Promoted manifests must never point into `source`, `sources`, `_archive`,
`archive`, `cache`, `draft`, `master`, `provenance`, `temp`, or `tmp` segments.
The audit applies this rule recursively to nested `path` fields and rejects
banned generator names anywhere in promoted manifest metadata.

## Naming and provenance

Generated history uses semantic lowercase kebab-case names and exactly one
`YYYY-MM-DD` directory. Provider IDs and raw cache filenames are allowed only
inside quarantine; rename selected files before moving them into curated
history.

Store decision-relevant provenance beside the preserved source: provider,
model, generation date, prompt/reference summary, license basis, and the
runtime derivative it produced. Never store credentials, private provider
responses, or secret-bearing request data.

## Related contracts

- [Asset package README](../README.md)
- [Runtime asset-format policy](./asset-format-policy.md)
- [`_archive` review rules](../_archive/README.md)
- Repository boundary: `AGENTS.md` and `.agents/memory/repo-boundary.md`
