// Vendor-agnostic feature-flag layer (#384) — dark-shipping + game visibility.
//
// PostHog is the runtime source, but call sites import ONLY from here, never
// `posthog-js`/PostHog directly, so the vendor can be swapped without touching
// feature code. PostHog is already a project dependency with VITE_POSTHOG_* /
// NEXT_PUBLIC_POSTHOG_* env wired — this is a wiring layer, not a new vendor.
//
// ── Hard boundary: flags vs paywall ────────────────────────────────────────
// This layer is a UX toggle, NOT a security boundary. It is kept strictly
// separate from the paywall (lib/access.ts + the proxy.ts entitlement gate):
//
//   | Question                                    | System                       |
//   |---------------------------------------------|------------------------------|
//   | Is the game shipped / visible / ramping?    | THIS layer (PostHog flag)    |
//   | Is the game free or paid?                   | lib/access.ts static list    |
//   | Did THIS user pay for the paid game?        | Clerk + Stripe entitlement   |
//
// A flag NEVER grants access — it only hides or reveals. A game shows iff
// `isGameVisible(slug)` AND the paywall (free OR Clerk entitlement) passes.
//
// ── Resolution precedence (highest → lowest) ────────────────────────────────
//   1. Explicit override  — FLAG_OVERRIDES env (JSON map). Kill-switch + tests.
//   2. Remote value       — PostHog evaluation (redeploy-free ramp).
//   3. Registry default   — flagDefault(flag) below.
//
// See apps/web/docs/feature-flags.md for the naming convention and the
// "delete the flag after full rollout" cleanup habit.

/** Minimal identity for flag evaluation — never imports a vendor user type. */
export type FlagUser = { id?: string | null; email?: string | null } | null | undefined;

/**
 * Defaults for named (non-game) flags. Add a flag here the moment a call site
 * references it, so the default is reviewable in one place. Game-visibility
 * flags are derived (one per game) and are NOT listed here — they default ON
 * (see flagDefault) so a new game stays visible until someone explicitly
 * kills it or ramps it from 0%.
 */
export const FLAG_DEFAULTS: Record<string, boolean> = {};

/** Game-visibility flag keys match `game-<slug>-visible`. */
const GAME_VISIBLE_RE = /^game-[a-z0-9-]+-visible$/;

/** Naming convention: the visibility flag for a game slug. */
export function gameVisibilityFlag(slug: string): string {
  return `game-${slug}-visible`;
}

/**
 * The fallback value when neither an override nor a remote value resolves.
 * Unknown game-visibility flags default ON (don't hide existing games until
 * explicitly killed); every other unknown flag defaults OFF — dark by default,
 * the safe stance for dark-shipping unfinished work.
 */
export function flagDefault(flag: string): boolean {
  if (Object.hasOwn(FLAG_DEFAULTS, flag)) return FLAG_DEFAULTS[flag];
  return GAME_VISIBLE_RE.test(flag);
}

/**
 * Parse a FLAG_OVERRIDES JSON blob into a flag→bool map. Tolerant: malformed
 * JSON, a non-object, or non-boolean values are ignored (an override is only
 * honored when it is an explicit boolean), so a bad env var can never crash a
 * request or silently flip a flag to a truthy string.
 */
export function parseFlagOverrides(raw: string | undefined | null): Record<string, boolean> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

/** Pure resolver: override wins, then remote, then the registry default. */
export function resolveFlag(args: { override?: boolean; remote?: boolean; fallback: boolean }): boolean {
  if (typeof args.override === "boolean") return args.override;
  if (typeof args.remote === "boolean") return args.remote;
  return args.fallback;
}

// Read env per-call (never cache at module load) so the kill-switch responds
// without a restart and tests can set FLAG_OVERRIDES per case.
function overridesFromEnv(): Record<string, boolean> {
  return parseFlagOverrides(process.env.FLAG_OVERRIDES);
}

// ── Edge-safe synchronous path (no network) ─────────────────────────────────
// proxy.ts runs as edge middleware on every gated request; it uses ONLY the
// deterministic override+default path so the gate never awaits a network call.
// This is the kill-switch backstop; the live PostHog ramp drives the lobby
// gallery (a Node Server Component, below).

export function isEnabledSync(flag: string): boolean {
  const overrides = overridesFromEnv();
  return resolveFlag({ override: overrides[flag], fallback: flagDefault(flag) });
}

export function isGameVisibleSync(slug: string): boolean {
  return isEnabledSync(gameVisibilityFlag(slug));
}

// ── Remote (PostHog) evaluation ─────────────────────────────────────────────

type RemoteFetcher = (user: FlagUser) => Promise<Record<string, boolean>>;

/**
 * Evaluate flags via PostHog's stateless `/flags` decide endpoint with `fetch`
 * — no SDK, so it is safe on both the edge and node runtimes. Guarded: with no
 * key it resolves to `{}` instantly (no network), so CI/dev/keyless builds and
 * e2e never depend on PostHog being configured. Bounded by a short timeout and
 * fail-open (errors → `{}`) so flag eval can never wedge a page render.
 */
async function posthogFetcher(user: FlagUser): Promise<Record<string, boolean>> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return {};
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/+$/, "");
  const distinctId = user?.id || user?.email || "anonymous";
  try {
    const res = await fetch(`${host}/flags/?v=2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, distinct_id: distinctId }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return {};
    // The `/flags?v=2` endpoint returns a top-level `flags` map whose values are
    // NESTED detail objects (`{ key, enabled, variant, ... }`) — NOT the flat
    // `featureFlags` boolean/variant map of the legacy `/decide` endpoint.
    // Flatten to the `bool | "<variant>"` shape normalizeRemoteFlags expects.
    const data = (await res.json()) as { flags?: Record<string, V2FlagDetail> };
    return normalizeRemoteFlags(flattenV2Flags(data.flags));
  } catch {
    return {};
  }
}

/** A single flag entry in PostHog's `/flags?v=2` response. */
type V2FlagDetail = { enabled?: boolean; variant?: string | null };

/**
 * Flatten PostHog's `/flags?v=2` nested `flags` map into the flat
 * `true | false | "<variant>"` shape normalizeRemoteFlags consumes. `enabled`
 * gates on/off; when on with a multivariate `variant`, carry the variant string
 * through as the (truthy) value. Malformed/absent entries are skipped.
 */
export function flattenV2Flags(flags: Record<string, V2FlagDetail> | undefined): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  for (const [key, detail] of Object.entries(flags ?? {})) {
    if (!detail || typeof detail !== "object") continue;
    out[key] = detail.enabled === true ? (typeof detail.variant === "string" ? detail.variant : true) : false;
  }
  return out;
}

/**
 * PostHog returns `true | false | "<variant>"`. We treat any present value
 * other than `false` as enabled (a variant string means the flag is on); an
 * absent flag is left undefined so the registry default applies.
 */
export function normalizeRemoteFlags(flags: Record<string, unknown> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(flags ?? {})) {
    if (value === undefined || value === null) continue;
    out[key] = value !== false;
  }
  return out;
}

let remoteFetcher: RemoteFetcher = posthogFetcher;

/** Test seam: swap (or reset, with `null`) the remote flag source. */
export function __setRemoteFetcher(fetcher: RemoteFetcher | null): void {
  remoteFetcher = fetcher ?? posthogFetcher;
}

/**
 * The raw remote flag map for a user — the live PostHog evaluation, with NO
 * override/default resolution applied. Exposed so a Node render path can wrap
 * it in its own cache (e.g. `unstable_cache`) for ISR WITHOUT this module
 * importing `next/cache`, which must stay out of the edge `proxy.ts` bundle.
 * The PostHog decide call is a POST, so Next's fetch data-cache cannot cache it
 * — the caller owns caching. Always fail-open to `{}` (see posthogFetcher).
 */
export async function fetchRemoteFlags(user?: FlagUser): Promise<Record<string, boolean>> {
  return remoteFetcher(user);
}

// ── Async public API (override + remote + default) ──────────────────────────

export async function isEnabled(flag: string, user?: FlagUser): Promise<boolean> {
  const overrides = overridesFromEnv();
  // Override wins outright — skip the network entirely when one is pinned.
  if (typeof overrides[flag] === "boolean") return overrides[flag];
  const remote = await fetchRemoteFlags(user);
  return resolveFlag({ remote: remote[flag], fallback: flagDefault(flag) });
}

export async function isGameVisible(slug: string, user?: FlagUser): Promise<boolean> {
  return isEnabled(gameVisibilityFlag(slug), user);
}

/**
 * Pure resolver: pick the visible games from a pre-fetched remote map, applying
 * the env override + registry default precedence. Synchronous and network-free,
 * so a render path can fetch (and cache) the remote map once, then resolve here.
 * Reads FLAG_OVERRIDES per call, so the kill-switch stays instant even when the
 * remote map is served from a stale ISR cache.
 */
export function selectVisibleGames<T extends { slug: string }>(games: T[], remote: Record<string, boolean>): T[] {
  const overrides = overridesFromEnv();
  return games.filter((game) => {
    const flag = gameVisibilityFlag(game.slug);
    return resolveFlag({ override: overrides[flag], remote: remote[flag], fallback: flagDefault(flag) });
  });
}

/**
 * Filter a game list to the visible ones with a SINGLE remote evaluation
 * (never one fetch per game). The gallery uses this to drop killed / un-ramped
 * games. Visibility composes with — never replaces — the paywall: a visible
 * game still passes through the proxy entitlement gate before it is playable.
 */
export async function filterVisibleGames<T extends { slug: string }>(games: T[], user?: FlagUser): Promise<T[]> {
  return selectVisibleGames(games, await fetchRemoteFlags(user));
}
