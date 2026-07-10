# Deadrot Brand Runtime Assets

These are the canonical package-backed Deadrot marks used by the web app and
asset CDN.

`../masters/ui/brand/favicon/` is the single source for favicon outputs. Vite
copies that directory into each standalone game build through `publicDir`,
while the web asset sync publishes it at `/favicon/`. App `public/` folders do
not own tracked favicon copies, and the PNG favicon masters do not weaken the
WebP runtime-art policy.

## 2026-06-24 - alpha fringe cleanup

- Issue: `deadrot.com#289`.
- Files: `wordmark.webp`, `title.webp`, `mark.webp`.
- Source: existing committed runtime brand art.
- Tooling: deterministic local cleanup with `dwebp`,
  `scripts/fix-brand-alpha-fringe.mjs`, and `cwebp` with `-alpha_q 100`.
- Notes: no new raster art was generated. Dark lossy-alpha matte pixels on
  transparent edges were rematted from nearby opaque subject colors, then the
  marks were re-encoded as high-quality alpha WebP.
