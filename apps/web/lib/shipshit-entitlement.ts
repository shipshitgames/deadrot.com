import type Stripe from "stripe";

import { COLLECTION_FLAG } from "./access";

// Cross-property entitlement (#330 follow-up): an active shipshit.games
// "Studio Pass" subscription grants the Deadrot Collection here.
//
// deadrot.com and shipshit.games run TWO different Clerk instances but share
// ONE Stripe account ("Ship Sh!t Dev"), so the bridge is:
//   Clerk user's VERIFIED email -> shared Stripe customer(s) -> active
//   subscription on a Studio Pass price -> publicMetadata.deadrotCollection.
//
// Grants made this way are marked deadrotCollectionGrantedVia: "shipshit-sub"
// so they can be revoked when the subscription lapses. One-time purchases
// (deadrotCollectionPurchasedAt, no grantedVia) are permanent and must never
// be touched by this logic.
//
// This module is the pure decision core — no Stripe/Clerk calls, no env reads
// beyond the product-id allowlist — so the grant/revoke rules are unit-testable
// (tests/unit/shipshit-entitlement.test.ts). The I/O lives in
// shipshit-entitlement-sync.ts (pull reconcile) and the Stripe webhook (push).

export const SHIPSHIT_GRANT_SOURCE = "shipshit-sub" as const;

export const GRANTED_VIA_KEY = "deadrotCollectionGrantedVia" as const;
export const CHECKED_AT_KEY = "deadrotCollectionCheckedAt" as const;
export const PURCHASED_AT_KEY = "deadrotCollectionPurchasedAt" as const;

// Stripe price lookup_key convention pinned by the shipshit.games repo
// (packages/shared STUDIO_PASS.priceLookupKey) — stable across test/live mode,
// so the live Studio Pass launch needs no config change here.
const SHIPSHIT_SUB_PRICE_LOOKUP_KEYS: readonly string[] = ["shipshit-studio-pass-49-usd-monthly"];

// Mirrors shipshit.games's ACTIVE_SUBSCRIPTION_STATUSES: past_due loses access
// there too, and Stripe Smart Retries re-fire customer.subscription.updated on
// recovery, which re-grants.
export const ACTIVE_SUB_STATUSES: readonly string[] = ["active", "trialing"];

// Re-check cadences, enforced via deadrotCollectionCheckedAt:
//   - non-owners: how often the proxy re-polls Stripe before bouncing to
//     /unlock (the /unlock page itself re-checks on a much shorter floor, so a
//     fresh subscriber is never stuck behind this window);
//   - sub-backed grants: lapse safety net in case a webhook delivery is missed
//     (the webhook normally revokes within ~60s of the subscription ending).
export const NOT_OWNED_RECHECK_MS = 10 * 60 * 1000;
export const SUB_GRANT_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;
export const UNLOCK_PAGE_RECHECK_MS = 30 * 1000;

/** Extra qualifying Stripe product ids (comma-separated env allowlist). */
export function shipshitProductIds(value = process.env.SHIPSHIT_STRIPE_PRODUCT_IDS): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function priceProductId(product: Stripe.Price["product"] | null | undefined): string | undefined {
  if (typeof product === "string") return product;
  return product?.id;
}

/**
 * True when any line of the subscription is a shipshit.games Studio Pass
 * price. The shared Stripe account carries unrelated products (the deadrot
 * one-time unlock, consulting) — only the lookup-key convention or the
 * explicit product allowlist may qualify a subscription, never "any sub".
 */
export function isShipshitSubscription(
  subscription: Pick<Stripe.Subscription, "items">,
  productIds: readonly string[] = shipshitProductIds(),
): boolean {
  return subscription.items.data.some((item) => {
    const price = item.price;
    if (!price) return false;
    if (price.lookup_key && SHIPSHIT_SUB_PRICE_LOOKUP_KEYS.includes(price.lookup_key)) return true;
    const productId = priceProductId(price.product);
    return Boolean(productId && productIds.includes(productId));
  });
}

export type CollectionMeta = {
  /** publicMetadata.deadrotCollection === true */
  owned: boolean;
  /** deadrotCollectionGrantedVia, e.g. "shipshit-sub"; absent for purchases. */
  via: string | undefined;
  /** deadrotCollectionCheckedAt as epoch ms, NaN-free; undefined if unset/bad. */
  checkedAtMs: number | undefined;
  /** deadrotCollectionPurchasedAt present — a paid one-time unlock. */
  purchased: boolean;
};

export function readCollectionMeta(metadata: unknown): CollectionMeta {
  const bag = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const checkedAtRaw = bag[CHECKED_AT_KEY];
  const checkedAtMs = typeof checkedAtRaw === "string" ? Date.parse(checkedAtRaw) : Number.NaN;
  return {
    owned: bag[COLLECTION_FLAG] === true,
    via: typeof bag[GRANTED_VIA_KEY] === "string" ? (bag[GRANTED_VIA_KEY] as string) : undefined,
    checkedAtMs: Number.isFinite(checkedAtMs) ? checkedAtMs : undefined,
    purchased: Boolean(bag[PURCHASED_AT_KEY]),
  };
}

export type ReconcileAction = "grant" | "revoke" | "refresh" | "stamp" | "none";

export type ReconcilePlan = {
  action: ReconcileAction;
  /** Clerk publicMetadata merge patch; null values delete keys. */
  patch: Record<string, unknown> | null;
  /** Entitlement state after the patch lands. */
  owned: boolean;
};

/**
 * Decide how publicMetadata must change given whether an active Studio Pass
 * subscription exists for the user's verified email right now.
 *
 * Invariants:
 *   - never downgrade a purchase (or any non-"shipshit-sub" grant) to a
 *     revocable grant, and never revoke one;
 *   - revoke ONLY grants marked "shipshit-sub" (and never when a purchase
 *     timestamp exists — that metadata state means the user paid);
 *   - always leave a checkedAt stamp so callers can throttle Stripe polling.
 */
export function planShipshitReconcile(meta: CollectionMeta, hasActiveSub: boolean, nowIso: string): ReconcilePlan {
  if (hasActiveSub) {
    if (!meta.owned) {
      return {
        action: "grant",
        owned: true,
        patch: {
          [COLLECTION_FLAG]: true,
          [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE,
          [CHECKED_AT_KEY]: nowIso,
        },
      };
    }
    if (meta.via === SHIPSHIT_GRANT_SOURCE) {
      return { action: "refresh", owned: true, patch: { [CHECKED_AT_KEY]: nowIso } };
    }
    // Owned through a purchase (or some other grant) — leave it untouched.
    return { action: "none", owned: true, patch: null };
  }

  if (meta.owned && meta.via === SHIPSHIT_GRANT_SOURCE) {
    if (meta.purchased) {
      // Defensive: a purchase timestamp means money changed hands — keep the
      // collection and just drop the revocable marker that should never have
      // coexisted with it.
      return {
        action: "refresh",
        owned: true,
        patch: { [GRANTED_VIA_KEY]: null, [CHECKED_AT_KEY]: nowIso },
      };
    }
    return {
      action: "revoke",
      owned: false,
      patch: {
        [COLLECTION_FLAG]: null,
        [GRANTED_VIA_KEY]: null,
        [CHECKED_AT_KEY]: nowIso,
      },
    };
  }

  if (meta.owned) {
    // Purchase or other grant — not ours to manage.
    return { action: "none", owned: true, patch: null };
  }

  // Not owned, no sub: stamp the check so gated requests don't re-poll Stripe.
  return { action: "stamp", owned: false, patch: { [CHECKED_AT_KEY]: nowIso } };
}

/**
 * Should we hit Stripe for this user right now? Purchases never need a sync;
 * sub-backed grants re-validate on a long TTL (webhook lapse safety net);
 * non-owners re-check on a short TTL so a fresh shipshit.games subscriber
 * gets in without manual steps.
 */
export function needsShipshitSync(meta: CollectionMeta, nowMs: number, opts?: { notOwnedTtlMs?: number }): boolean {
  if (meta.owned) {
    if (meta.via !== SHIPSHIT_GRANT_SOURCE) return false;
    return meta.checkedAtMs === undefined || nowMs - meta.checkedAtMs > SUB_GRANT_RECHECK_MS;
  }
  const ttl = opts?.notOwnedTtlMs ?? NOT_OWNED_RECHECK_MS;
  return meta.checkedAtMs === undefined || nowMs - meta.checkedAtMs > ttl;
}
