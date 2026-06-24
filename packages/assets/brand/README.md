# Deadrot Brand Runtime Assets

These are the canonical package-backed Deadrot marks used by the web app and
asset CDN.

## 2026-06-24 - alpha fringe cleanup

- Issue: `deadrot.com#289`.
- Files: `wordmark.webp`, `title.webp`, `mark.webp`.
- Source: existing committed runtime brand art.
- Tooling: deterministic local cleanup with `dwebp`,
  `scripts/fix-brand-alpha-fringe.mjs`, and `cwebp` with `-alpha_q 100`.
- Notes: no new raster art was generated. Dark lossy-alpha matte pixels on
  transparent edges were rematted from nearby opaque subject colors, then the
  marks were re-encoded as high-quality alpha WebP.
