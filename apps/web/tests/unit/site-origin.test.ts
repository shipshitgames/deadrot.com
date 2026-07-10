import { describe, expect, test } from "bun:test";

import { canonicalSiteOrigin } from "@/lib/site-origin";

describe("canonicalSiteOrigin", () => {
  test("requires explicit configuration in production", () => {
    expect(() => canonicalSiteOrigin({ NODE_ENV: "production", VERCEL_ENV: "production" })).toThrow(
      "DEADROT_SITE_ORIGIN is required",
    );
  });

  test("requires explicit configuration for previews", () => {
    expect(() => canonicalSiteOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toThrow(
      "DEADROT_SITE_ORIGIN is required",
    );
  });

  test("accepts only a clean HTTPS origin outside local development", () => {
    expect(
      canonicalSiteOrigin({
        DEADROT_SITE_ORIGIN: "https://preview-deadrot.vercel.app",
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      }),
    ).toBe("https://preview-deadrot.vercel.app");
    expect(() => canonicalSiteOrigin({ DEADROT_SITE_ORIGIN: "http://deadrot.com", NODE_ENV: "production" })).toThrow();
    expect(() =>
      canonicalSiteOrigin({ DEADROT_SITE_ORIGIN: "https://deadrot.com/path", NODE_ENV: "production" }),
    ).toThrow();
  });

  test("has a narrow localhost-only development policy", () => {
    expect(canonicalSiteOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(canonicalSiteOrigin({ DEADROT_SITE_ORIGIN: "http://127.0.0.1:3100", NODE_ENV: "development" })).toBe(
      "http://127.0.0.1:3100",
    );
    expect(() =>
      canonicalSiteOrigin({ DEADROT_SITE_ORIGIN: "http://attacker.test", NODE_ENV: "development" }),
    ).toThrow();
    expect(() =>
      canonicalSiteOrigin({ DEADROT_SITE_ORIGIN: "https://attacker.test", NODE_ENV: "development" }),
    ).toThrow();
  });
});
