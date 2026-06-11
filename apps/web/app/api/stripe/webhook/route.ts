import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { COLLECTION_FLAG } from "@/lib/access";

// Stripe webhook: on checkout.session.completed for the Deadrot Collection,
// record the entitlement on the Clerk user (publicMetadata.deadrotCollection).
// proxy.ts reads it from session claims; no database needed for v1 (#330).

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.clerkUserId ?? session.client_reference_id;
    if (session.payment_status === "paid" && userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          [COLLECTION_FLAG]: true,
          deadrotCollectionPurchasedAt: new Date().toISOString(),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
