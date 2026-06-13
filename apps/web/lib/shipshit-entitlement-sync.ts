import type { User } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

import {
  ACTIVE_SUB_STATUSES,
  isShipshitSubscription,
  needsShipshitSync,
  planShipshitReconcile,
  readCollectionMeta,
  SHIPSHIT_GRANT_SOURCE,
} from "./shipshit-entitlement";

// I/O half of the cross-property entitlement (decision rules live in
// shipshit-entitlement.ts): look up the shared Stripe account by the Clerk
// user's VERIFIED emails and reconcile publicMetadata.deadrotCollection.
//
// Callers: proxy.ts (throttled, on the authoritative fallback path), the
// /unlock page (short throttle), and the Stripe webhook (subscription events
// re-run the same reconcile, which makes out-of-order deliveries harmless —
// the plan is always derived from Stripe's current state, never the event's).

/** Kill switch + config gate: without a Stripe key there is nothing to query. */
export function shipshitSyncEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && process.env.SHIPSHIT_ENTITLEMENT_DISABLED !== "1";
}

/**
 * The user's verified emails, primary first, lowercased. Verification is the
 * security boundary: Clerk proved ownership, so a Stripe customer with that
 * email is this person. An unverified address must never qualify — anyone can
 * type a known subscriber's email into sign-up.
 */
function verifiedEmails(user: User): string[] {
  const primaryId = user.primaryEmailAddressId;
  const verified = user.emailAddresses
    .filter((email) => email.verification?.status === "verified")
    .sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId))
    .map((email) => email.emailAddress.toLowerCase());
  return [...new Set(verified)];
}

/**
 * True when any Stripe customer carrying one of these emails has an active or
 * trialing Studio Pass subscription. Note customers.list email matching is
 * exact (Stripe documents it as case-sensitive); shipshit.games checkout
 * prefills customer_email from the Clerk primary email, which Clerk stores
 * lowercased, so lowercase queries line up in practice.
 */
async function hasActiveShipshitSubscription(stripe: Stripe, emails: readonly string[]): Promise<boolean> {
  for (const email of emails) {
    const customers = await stripe.customers.list({ email, limit: 100 });
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 100,
      });
      const match = subscriptions.data.some(
        (sub) => ACTIVE_SUB_STATUSES.includes(sub.status) && isShipshitSubscription(sub),
      );
      if (match) return true;
    }
  }
  return false;
}

export type SyncResult = {
  owned: boolean;
  /** True when the grant is the revocable shipshit-subscription kind. */
  viaShipshit: boolean;
};

/**
 * Reconcile one Clerk user against Stripe, unconditionally (no throttle):
 * grant when an active Studio Pass exists, revoke a lapsed sub-grant, never
 * touch purchases. Throws on Stripe/Clerk failures — callers decide whether
 * to retry (webhook) or fail open (gate, /unlock).
 */
export async function syncShipshitEntitlement(user: User): Promise<SyncResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  const stripe = new Stripe(secretKey);
  const emails = verifiedEmails(user);
  const hasActiveSub = emails.length > 0 && (await hasActiveShipshitSubscription(stripe, emails));

  const meta = readCollectionMeta(user.publicMetadata);
  const plan = planShipshitReconcile(meta, hasActiveSub, new Date().toISOString());

  if (plan.patch) {
    const client = await clerkClient();
    // updateUserMetadata merges; null values delete keys — no read-modify-write
    // race with the purchase webhook's writer.
    await client.users.updateUserMetadata(user.id, { publicMetadata: plan.patch });
    if (plan.action === "grant" || plan.action === "revoke") {
      console.log(
        `[shipshit-entitlement] ${plan.action} deadrotCollection for ${user.id} (active sub: ${hasActiveSub})`,
      );
    }
  }

  return {
    owned: plan.owned,
    viaShipshit: plan.owned && (plan.action === "grant" || meta.via === SHIPSHIT_GRANT_SOURCE),
  };
}

/**
 * Throttled, fail-open reconcile for request paths (gate, /unlock): returns
 * the user's entitlement after at most one Stripe round-trip per TTL window.
 * On Stripe/Clerk errors the current metadata state stands — a lapsed grant
 * survives until the next successful check rather than locking out a player
 * because Stripe hiccuped.
 */
export async function ensureShipshitEntitlement(user: User, opts?: { notOwnedTtlMs?: number }): Promise<SyncResult> {
  const meta = readCollectionMeta(user.publicMetadata);
  const current: SyncResult = {
    owned: meta.owned,
    viaShipshit: meta.owned && meta.via === SHIPSHIT_GRANT_SOURCE,
  };
  if (!shipshitSyncEnabled() || !needsShipshitSync(meta, Date.now(), opts)) return current;
  try {
    return await syncShipshitEntitlement(user);
  } catch (err) {
    console.error(`[shipshit-entitlement] sync failed for ${user.id} — failing open`, err);
    return current;
  }
}
