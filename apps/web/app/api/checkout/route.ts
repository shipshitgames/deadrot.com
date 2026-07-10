import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { authEnabled, COLLECTION_FLAG, DEFAULT_STRIPE_PRICE_ID, EARLY_BUYER_CODE, hasCollection } from "@/lib/access";
import { canonicalSiteOrigin } from "@/lib/site-origin";

// Creates a Stripe Checkout Session for the Deadrot Collection one-time unlock.
// The Clerk userId rides along in metadata so the webhook can flip the
// entitlement on the right user; the email prefills checkout. The entitlement
// marker in metadata is what the webhook trusts — only sessions created here
// grant the collection, never other products on the Stripe account.

type CheckoutUser = {
  primaryEmailAddress?: { emailAddress: string } | null;
  publicMetadata: unknown;
};

export type CheckoutDependencies = {
  authenticate: () => Promise<{ userId: string | null }>;
  createStripe: (secretKey: string) => Stripe;
  getUser: (userId: string) => Promise<CheckoutUser>;
};

const productionDependencies: CheckoutDependencies = {
  authenticate: auth,
  createStripe: (secretKey) => new Stripe(secretKey),
  getUser: async (userId) => {
    const client = await clerkClient();
    return client.users.getUser(userId);
  },
};

export async function handleCheckout(
  _req: Request,
  dependencies: CheckoutDependencies = productionDependencies,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  const secretKey = env.STRIPE_SECRET_KEY;
  const enabled = dependencies === productionDependencies ? authEnabled : true;
  if (!enabled || !secretKey) {
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  }

  const { userId } = await dependencies.authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to buy the collection" }, { status: 401 });
  }

  const user = await dependencies.getUser(userId);

  // Owners have nothing to buy — send them back to the unlock page instead of
  // letting a stale tab double-charge them.
  if (hasCollection(user.publicMetadata)) {
    return NextResponse.json({ url: "/unlock/" });
  }

  let siteOrigin: string;
  try {
    siteOrigin = canonicalSiteOrigin(env);
  } catch {
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  }

  const stripe = dependencies.createStripe(secretKey);
  const email = user.primaryEmailAddress?.emailAddress;

  const baseParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: env.STRIPE_PRICE_ID ?? DEFAULT_STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: userId,
    metadata: { clerkUserId: userId, entitlement: COLLECTION_FLAG },
    customer_email: email,
    success_url: `${siteOrigin}/unlock/?success=1`,
    cancel_url: `${siteOrigin}/unlock/?canceled=1`,
  };

  // Pre-apply the early-buyer promo so checkout opens at the discounted price
  // instead of hiding it behind "Add promotion code". Resolved from its
  // customer-facing code each request (no hardcoded promo id) so the access.ts
  // constant stays the single source of truth; once it expires or hits its
  // redemption cap the lookup returns nothing and we fall back to manual entry.
  const promotionId = await redeemablePromotionId(stripe, env.STRIPE_PROMO_CODE ?? EARLY_BUYER_CODE);
  const session = await createCheckoutSession(stripe, baseParams, promotionId);

  return NextResponse.json({ url: session.url });
}

export async function POST(req: Request): Promise<Response> {
  return handleCheckout(req);
}

/**
 * The id of the active, still-redeemable promotion code matching `code` (the
 * customer-facing string, e.g. FIRSTROT), or undefined when it's missing,
 * exhausted, expired, or Stripe can't be reached — so a promo hiccup degrades to
 * manual entry rather than blocking a sale.
 */
async function redeemablePromotionId(stripe: Stripe, code: string): Promise<string | undefined> {
  try {
    const { data } = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    const promo = data[0];
    if (!promo) return undefined;
    const capped = promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions;
    const expired = promo.expires_at !== null && promo.expires_at <= Math.floor(Date.now() / 1000);
    return capped || expired ? undefined : promo.id;
  } catch {
    return undefined;
  }
}

/**
 * Create the session with the promo pre-applied (`discounts` and
 * `allow_promotion_codes` are mutually exclusive, so it's one or the other). If
 * Stripe rejects the discount itself (e.g. product restrictions), fall back to
 * manual entry; any other error propagates so a real outage isn't masked.
 */
async function createCheckoutSession(
  stripe: Stripe,
  baseParams: Stripe.Checkout.SessionCreateParams,
  promotionId: string | undefined,
): Promise<Stripe.Checkout.Session> {
  if (promotionId) {
    try {
      return await stripe.checkout.sessions.create({ ...baseParams, discounts: [{ promotion_code: promotionId }] });
    } catch (err) {
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err;
    }
  }
  return stripe.checkout.sessions.create({ ...baseParams, allow_promotion_codes: true });
}
