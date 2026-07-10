import { describe, expect, mock, test } from "bun:test";
import type Stripe from "stripe";

import { type CheckoutDependencies, handleCheckout } from "@/app/api/checkout/route";

function dependencies(options?: { owner?: boolean }) {
  const create = mock(async (params: Stripe.Checkout.SessionCreateParams) => ({
    id: "cs_test",
    url: "https://checkout.stripe.test/session",
    params,
  }));
  const stripe = {
    checkout: { sessions: { create } },
    promotionCodes: { list: mock(async () => ({ data: [] })) },
  } as unknown as Stripe;
  const deps: CheckoutDependencies = {
    authenticate: async () => ({ userId: "user_123" }),
    createStripe: () => stripe,
    getUser: async () => ({
      primaryEmailAddress: { emailAddress: "owner@deadrot.com" },
      publicMetadata: options?.owner ? { deadrotCollection: true } : {},
    }),
  };
  return { create, deps };
}

describe("POST /api/checkout", () => {
  test("ignores a hostile Origin and uses the configured canonical site origin", async () => {
    const { create, deps } = dependencies();
    const response = await handleCheckout(
      new Request("https://deadrot.com/api/checkout/", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
      deps,
      {
        DEADROT_SITE_ORIGIN: "https://deadrot.com",
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: "sk_test_placeholder",
        VERCEL_ENV: "production",
      },
    );

    expect(response.status).toBe(200);
    const params = (create.mock.calls[0] as [Stripe.Checkout.SessionCreateParams])[0];
    expect(params.success_url).toBe("https://deadrot.com/unlock/?success=1");
    expect(params.cancel_url).toBe("https://deadrot.com/unlock/?canceled=1");
    expect(JSON.stringify(params)).not.toContain("attacker.example");
  });

  test("an owner gets the no-op return without creating a Stripe session", async () => {
    const { create, deps } = dependencies({ owner: true });
    const response = await handleCheckout(new Request("https://deadrot.com/api/checkout/", { method: "POST" }), deps, {
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      VERCEL_ENV: "production",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "/unlock/" });
    expect(create).not.toHaveBeenCalled();
  });

  test("missing canonical production config fails before Stripe is called", async () => {
    const { create, deps } = dependencies();
    const response = await handleCheckout(new Request("https://deadrot.com/api/checkout/", { method: "POST" }), deps, {
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      VERCEL_ENV: "production",
    });

    expect(response.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
});
