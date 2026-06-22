# Asset Review Archive

This folder is package-local review custody for raw, rejected, banned-provider,
or otherwise unpromoted asset material.

Files here are not runtime assets, are not exported by `@shipshitgames/assets`,
and must not be referenced by manifests, apps, or CDN sync jobs. Keep review
batches here when they still need human triage and would otherwise be lost from
worktrees or local generator caches.

## Promotion rule

- Approved runtime assets move to semantic runtime paths such as
  `games/<game>/...`, `entities/<entity-id>/<game>.webp`, or `shared/...`.
- Approved generated history moves to semantic dated paths under
  `sources/generated/...`.
- Rejected or banned-provider material stays here only while useful for review,
  then gets deleted.

Raw provider cache names may stay intact in `_archive` for traceability. Do not
carry provider IDs, UUID folders, or cache filenames into `sources/generated`.
