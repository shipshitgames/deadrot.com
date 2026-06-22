import { describe, expect, test } from "bun:test";

import { COLLECTION_FLAG } from "@/lib/access";
import {
  CHECKED_AT_KEY,
  GRANTED_VIA_KEY,
  isShipshitSubscription,
  NOT_OWNED_RECHECK_MS,
  needsShipshitSync,
  PURCHASED_AT_KEY,
  planShipshitReconcile,
  readCollectionMeta,
  SHIPSHIT_GRANT_SOURCE,
  SUB_GRANT_RECHECK_MS,
  shipshitProductIds,
} from "@/lib/shipshit-entitlement";

const NOW_ISO = "2026-06-11T12:00:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);

const STUDIO_PASS_LOOKUP_KEY = "shipshit-studio-pass-49-usd-monthly";

type FakePrice = { lookup_key?: string | null; product?: unknown };

function sub(...prices: FakePrice[]) {
  // Matches the Stripe.Subscription shape isShipshitSubscription consumes.
  return {
    items: { data: prices.map((price) => ({ price })) },
  } as unknown as Parameters<typeof isShipshitSubscription>[0];
}

describe("shipshitProductIds", () => {
  test("parses a comma-separated allowlist with whitespace and blanks", () => {
    expect(shipshitProductIds("prod_a, prod_b ,,prod_c")).toEqual(["prod_a", "prod_b", "prod_c"]);
  });

  test("empty/undefined env means no extra product ids", () => {
    expect(shipshitProductIds(undefined)).toEqual([]);
    expect(shipshitProductIds("")).toEqual([]);
  });
});

describe("isShipshitSubscription", () => {
  test("matches the Studio Pass price lookup key", () => {
    expect(isShipshitSubscription(sub({ lookup_key: STUDIO_PASS_LOOKUP_KEY }), [])).toBe(true);
  });

  test("matches an allowlisted product id (string form)", () => {
    expect(isShipshitSubscription(sub({ product: "prod_pass" }), ["prod_pass"])).toBe(true);
  });

  test("matches an allowlisted product id (expanded object form)", () => {
    expect(isShipshitSubscription(sub({ product: { id: "prod_pass" } }), ["prod_pass"])).toBe(true);
  });

  test("rejects unrelated subscriptions on the shared account", () => {
    // e.g. the consulting subscription must never grant the collection.
    expect(isShipshitSubscription(sub({ lookup_key: null, product: "prod_consulting" }), ["prod_pass"])).toBe(false);
    expect(isShipshitSubscription(sub({ product: "prod_anything" }), [])).toBe(false);
  });

  test("matches when any one item of a multi-line subscription qualifies", () => {
    expect(isShipshitSubscription(sub({ product: "prod_other" }, { lookup_key: STUDIO_PASS_LOOKUP_KEY }), [])).toBe(
      true,
    );
  });
});

describe("readCollectionMeta", () => {
  test("reads a sub-granted state", () => {
    const meta = readCollectionMeta({
      [COLLECTION_FLAG]: true,
      [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE,
      [CHECKED_AT_KEY]: NOW_ISO,
    });
    expect(meta).toEqual({
      owned: true,
      via: SHIPSHIT_GRANT_SOURCE,
      checkedAtMs: NOW_MS,
      purchased: false,
    });
  });

  test("tolerates junk metadata", () => {
    expect(readCollectionMeta(undefined).owned).toBe(false);
    expect(readCollectionMeta("nope").owned).toBe(false);
    expect(readCollectionMeta({ [COLLECTION_FLAG]: "true" }).owned).toBe(false);
    expect(readCollectionMeta({ [CHECKED_AT_KEY]: "not-a-date" }).checkedAtMs).toBeUndefined();
  });

  test("flags purchases", () => {
    const meta = readCollectionMeta({
      [COLLECTION_FLAG]: true,
      [PURCHASED_AT_KEY]: "2026-01-01T00:00:00.000Z",
    });
    expect(meta.purchased).toBe(true);
    expect(meta.via).toBeUndefined();
  });
});

describe("planShipshitReconcile", () => {
  const fresh = (metadata: Record<string, unknown>) => readCollectionMeta(metadata);

  test("grants a non-owner with an active sub, marked revocable", () => {
    const plan = planShipshitReconcile(fresh({}), true, NOW_ISO);
    expect(plan.action).toBe("grant");
    expect(plan.owned).toBe(true);
    expect(plan.patch).toEqual({
      [COLLECTION_FLAG]: true,
      [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE,
      [CHECKED_AT_KEY]: NOW_ISO,
    });
  });

  test("refreshes the stamp on an existing sub-grant", () => {
    const plan = planShipshitReconcile(
      fresh({ [COLLECTION_FLAG]: true, [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE }),
      true,
      NOW_ISO,
    );
    expect(plan.action).toBe("refresh");
    expect(plan.patch).toEqual({ [CHECKED_AT_KEY]: NOW_ISO });
  });

  test("never touches a purchase, even with an active sub", () => {
    const plan = planShipshitReconcile(fresh({ [COLLECTION_FLAG]: true, [PURCHASED_AT_KEY]: NOW_ISO }), true, NOW_ISO);
    expect(plan.action).toBe("none");
    expect(plan.patch).toBeNull();
    expect(plan.owned).toBe(true);
  });

  test("revokes a lapsed sub-grant (and deletes the marker keys)", () => {
    const plan = planShipshitReconcile(
      fresh({ [COLLECTION_FLAG]: true, [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE }),
      false,
      NOW_ISO,
    );
    expect(plan.action).toBe("revoke");
    expect(plan.owned).toBe(false);
    expect(plan.patch).toEqual({
      [COLLECTION_FLAG]: null,
      [GRANTED_VIA_KEY]: null,
      [CHECKED_AT_KEY]: NOW_ISO,
    });
  });

  test("never revokes when a purchase timestamp exists — drops the marker instead", () => {
    const plan = planShipshitReconcile(
      fresh({
        [COLLECTION_FLAG]: true,
        [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE,
        [PURCHASED_AT_KEY]: "2026-01-01T00:00:00.000Z",
      }),
      false,
      NOW_ISO,
    );
    expect(plan.action).toBe("refresh");
    expect(plan.owned).toBe(true);
    expect(plan.patch).toEqual({ [GRANTED_VIA_KEY]: null, [CHECKED_AT_KEY]: NOW_ISO });
  });

  test("never revokes grants from other sources", () => {
    const plan = planShipshitReconcile(
      fresh({ [COLLECTION_FLAG]: true, [GRANTED_VIA_KEY]: "support-comp" }),
      false,
      NOW_ISO,
    );
    expect(plan.action).toBe("none");
    expect(plan.owned).toBe(true);
  });

  test("never revokes a plain purchase (no grantedVia)", () => {
    const plan = planShipshitReconcile(fresh({ [COLLECTION_FLAG]: true, [PURCHASED_AT_KEY]: NOW_ISO }), false, NOW_ISO);
    expect(plan.action).toBe("none");
    expect(plan.owned).toBe(true);
  });

  test("stamps checkedAt for non-owners without a sub (poll throttle)", () => {
    const plan = planShipshitReconcile(fresh({}), false, NOW_ISO);
    expect(plan.action).toBe("stamp");
    expect(plan.owned).toBe(false);
    expect(plan.patch).toEqual({ [CHECKED_AT_KEY]: NOW_ISO });
  });
});

describe("needsShipshitSync", () => {
  const meta = (metadata: Record<string, unknown>) => readCollectionMeta(metadata);

  test("purchases never sync", () => {
    expect(needsShipshitSync(meta({ [COLLECTION_FLAG]: true, [PURCHASED_AT_KEY]: NOW_ISO }), NOW_MS)).toBe(false);
  });

  test("never-checked non-owners sync immediately", () => {
    expect(needsShipshitSync(meta({}), NOW_MS)).toBe(true);
  });

  test("non-owners throttle inside the TTL and re-check after it", () => {
    const checked = { [CHECKED_AT_KEY]: NOW_ISO };
    expect(needsShipshitSync(meta(checked), NOW_MS + NOT_OWNED_RECHECK_MS - 1000)).toBe(false);
    expect(needsShipshitSync(meta(checked), NOW_MS + NOT_OWNED_RECHECK_MS + 1000)).toBe(true);
  });

  test("non-owner TTL can be overridden (unlock page floor)", () => {
    const checked = meta({ [CHECKED_AT_KEY]: NOW_ISO });
    expect(needsShipshitSync(checked, NOW_MS + 60_000, { notOwnedTtlMs: 30_000 })).toBe(true);
    expect(needsShipshitSync(checked, NOW_MS + 10_000, { notOwnedTtlMs: 30_000 })).toBe(false);
  });

  test("sub-grants re-validate only after the long TTL", () => {
    const granted = meta({
      [COLLECTION_FLAG]: true,
      [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE,
      [CHECKED_AT_KEY]: NOW_ISO,
    });
    expect(needsShipshitSync(granted, NOW_MS + SUB_GRANT_RECHECK_MS - 1000)).toBe(false);
    expect(needsShipshitSync(granted, NOW_MS + SUB_GRANT_RECHECK_MS + 1000)).toBe(true);
  });

  test("sub-grants without a stamp re-validate immediately", () => {
    expect(needsShipshitSync(meta({ [COLLECTION_FLAG]: true, [GRANTED_VIA_KEY]: SHIPSHIT_GRANT_SOURCE }), NOW_MS)).toBe(
      true,
    );
  });
});
