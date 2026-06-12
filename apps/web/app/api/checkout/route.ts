import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { authEnabled, COLLECTION_FLAG, DEFAULT_STRIPE_PRICE_ID, hasCollection } from "@/lib/access";

// Creates a Stripe Checkout Session for the Deadrot Collection one-time unlock.
// The Clerk userId rides along in metadata so the webhook can flip the
// entitlement on the right user; the email prefills checkout. The entitlement
// marker in metadata is what the webhook trusts — only sessions created here
// grant the collection, never other products on the Stripe account.

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!authEnabled || !secretKey) {
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to buy the collection" }, { status: 401 });
  }

  const stripe = new Stripe(secretKey);
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Owners have nothing to buy — send them back to the unlock page instead of
  // letting a stale tab double-charge them.
  if (hasCollection(user.publicMetadata)) {
    return NextResponse.json({ url: "/unlock/" });
  }

  const email = user.primaryEmailAddress?.emailAddress;

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID ?? DEFAULT_STRIPE_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: userId,
    metadata: { clerkUserId: userId, entitlement: COLLECTION_FLAG },
    customer_email: email,
    success_url: `${origin}/unlock/?success=1`,
    cancel_url: `${origin}/unlock/?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
