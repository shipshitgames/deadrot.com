import { gameSlugs } from "@deadrot/catalog";

// Access policy for the early-access paywall (epic #330).
//
// Two tiers, enforced by proxy.ts at the shell choke point (games themselves
// are unauthenticated Vite SPAs behind the rewrite — the shell is the gate):
//   - FREE games: playable with a (free) signed-in account. Scourge Survivors
//     is the hook; Warline is the lobby every player must be able to walk.
//   - LOCKED games: require the Deadrot Collection purchase ($4.99 one-time,
//     Stripe price below) recorded on the Clerk user as
//     publicMetadata.deadrotCollection === true by the Stripe webhook.
//
// The gate degrades to fully open when Clerk env keys are absent (CI, local
// dev without secrets) so builds and e2e never depend on auth being configured.

export const FREE_GAME_SLUGS = ["scourge-survivors", "warline"] as const;

export const LOCKED_GAME_SLUGS: readonly string[] = (gameSlugs as readonly string[]).filter(
  (slug) => !(FREE_GAME_SLUGS as readonly string[]).includes(slug),
);

export const COLLECTION_FLAG = "deadrotCollection" as const;

export const COLLECTION_PRICE_LABEL = "$4.99";
export const EARLY_BUYER_CODE = "FIRSTROT";
export const EARLY_BUYER_PRICE_LABEL = "$2.99";

// Live one-time price for prod_UgEAC4hE4TFfoq ("deadrot.com"); override per env.
export const DEFAULT_STRIPE_PRICE_ID = "price_1Tgri8JLFu10NpzMceH1KZsS";

/** Clerk is wired only when its publishable key is present (build-time inlined). */
export const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function isLockedGameSlug(slug: string): boolean {
  return LOCKED_GAME_SLUGS.includes(slug);
}

/**
 * True when a Clerk publicMetadata bag (from sessionClaims.metadata or
 * user.publicMetadata) carries the collection entitlement.
 */
export function hasCollection(metadata: unknown): boolean {
  return Boolean(
    metadata && typeof metadata === "object" && (metadata as Record<string, unknown>)[COLLECTION_FLAG] === true,
  );
}
