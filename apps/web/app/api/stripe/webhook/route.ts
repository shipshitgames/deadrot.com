import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { COLLECTION_FLAG } from "@/lib/access";
import { CHECKED_AT_KEY, GRANTED_VIA_KEY, isShipshitSubscription, PURCHASED_AT_KEY } from "@/lib/shipshit-entitlement";
import { shipshitSyncEnabled, syncShipshitEntitlement } from "@/lib/shipshit-entitlement-sync";

// Stripe webhook: on a paid Checkout Session for the Deadrot Collection,
// record the entitlement on the Clerk user (publicMetadata.deadrotCollection).
// proxy.ts reads it from session claims; no database needed for v1 (#330).
//
// Also subscribed to customer.subscription.created/updated/deleted: the
// shared Stripe account carries the shipshit.games Studio Pass, whose
// lifecycle grants/revokes the collection here (cross-property entitlement —
// see lib/shipshit-entitlement.ts). Subscription events are treated only as
// "reconcile this customer now" triggers; the actual grant/revoke re-derives
// from Stripe's current state, so out-of-order deliveries are harmless.
//
// NOTE: with trailingSlash:true the endpoint MUST be registered with the
// trailing slash (/api/stripe/webhook/) — Stripe treats the 308 redirect on
// the slashless URL as a failed delivery.

function isClerkNotFound(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { status?: number }).status === 404);
}

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret || !process.env.CLERK_SECRET_KEY) {
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

  // completed covers instant methods (cards); async_payment_succeeded covers
  // delayed methods (e.g. bank debits) whose completed event arrives unpaid.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;

    // Only fulfill sessions our checkout route created — other products on
    // this Stripe account (or spoofed client_reference_id) must never grant
    // the collection.
    if (session.metadata?.entitlement !== COLLECTION_FLAG || session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const userId = session.metadata.clerkUserId;
    if (!userId) {
      // Permanently unfulfillable — ack so Stripe stops retrying, but leave a
      // loud trail (session id is enough to refund or grant manually).
      console.error(`[stripe-webhook] paid session ${session.id} has no clerkUserId — manual grant needed`);
      return NextResponse.json({ received: true });
    }

    try {
      const client = await clerkClient();
      // updateUserMetadata merges into existing publicMetadata — no
      // read-modify-write race with other metadata writers.
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          [COLLECTION_FLAG]: true,
          [PURCHASED_AT_KEY]: new Date().toISOString(),
          // A purchase is permanent: clear any revocable subscription-grant
          // marker so a later shipshit.games lapse can never revoke paid access.
          [GRANTED_VIA_KEY]: null,
          [CHECKED_AT_KEY]: null,
        },
      });
    } catch (err) {
      if (isClerkNotFound(err)) {
        console.error(
          `[stripe-webhook] paid session ${session.id}: Clerk user ${userId} not found — manual grant/refund needed`,
        );
        return NextResponse.json({ received: true });
      }
      // Transient (Clerk down, rate limit): 500 so Stripe retries with backoff.
      console.error(`[stripe-webhook] failed to grant ${userId} from session ${session.id}`, err);
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  // Studio Pass lifecycle (cross-property entitlement). The shared account
  // also bills unrelated subscriptions — only ones matching the Studio Pass
  // price lookup-key/product allowlist reconcile anything here.
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    if (!shipshitSyncEnabled() || !isShipshitSubscription(subscription)) {
      return NextResponse.json({ received: true });
    }

    try {
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const customer = await stripe.customers.retrieve(customerId);
      const email = customer.deleted ? null : customer.email;
      if (!email) {
        // No address to bridge on — the pull-side sync (proxy//unlock) still
        // covers the user if they ever show up here with a verified email.
        console.error(
          `[stripe-webhook] shipshit sub ${subscription.id}: customer ${customerId} has no email — skipping`,
        );
        return NextResponse.json({ received: true });
      }

      const client = await clerkClient();
      const { data: users } = await client.users.getUserList({
        emailAddress: [email],
        limit: 10,
      });
      const target = email.toLowerCase();
      for (const user of users) {
        // Only a VERIFIED address proves ownership — an unverified sign-up
        // with a subscriber's email must never inherit their entitlement.
        const verified = user.emailAddresses.some(
          (addr) => addr.emailAddress.toLowerCase() === target && addr.verification?.status === "verified",
        );
        if (!verified) continue;
        // Full reconcile (not the event payload): grants on active/trialing,
        // revokes lapsed "shipshit-sub" grants, never touches purchases.
        await syncShipshitEntitlement(user);
      }
    } catch (err) {
      // Transient (Stripe/Clerk down): 500 so Stripe retries with backoff.
      console.error(`[stripe-webhook] shipshit sub ${subscription.id}: reconcile failed`, err);
      return NextResponse.json({ error: "Entitlement sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
