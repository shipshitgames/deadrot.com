import { describe, expect, test } from "bun:test";

import {
  isHoneypotTripped,
  isValidEmail,
  MAX_EMAIL_LENGTH,
  MAX_SOURCE_LENGTH,
  normalizeEmail,
  normalizeSource,
  parseWaitlistFields,
  WAITLIST_SOURCE_DEFAULT,
} from "@/lib/waitlist";

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Survivor@DEADROT.com ")).toBe("survivor@deadrot.com");
  });

  test("non-strings become empty", () => {
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(42)).toBe("");
    expect(normalizeEmail(["a@b.co"])).toBe("");
  });
});

describe("isValidEmail", () => {
  test("accepts a plain address", () => {
    expect(isValidEmail("survivor@deadrot.com")).toBe(true);
    expect(isValidEmail("a.b+tag@sub.example.co")).toBe(true);
  });

  test("rejects junk", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("no-at-sign.com")).toBe(false);
    expect(isValidEmail("two@@at.com")).toBe(false);
    expect(isValidEmail("no@domain")).toBe(false); // no dot in domain
    expect(isValidEmail("spaces in@email.com")).toBe(false);
    expect(isValidEmail("trailing@space.com ")).toBe(false); // caller must normalize first
  });

  test("rejects an over-length address (RFC 5321 cap)", () => {
    const local = "a".repeat(MAX_EMAIL_LENGTH);
    expect(isValidEmail(`${local}@deadrot.com`)).toBe(false);
  });
});

describe("normalizeSource", () => {
  test("falls back to the default when blank or non-string", () => {
    expect(normalizeSource("")).toBe(WAITLIST_SOURCE_DEFAULT);
    expect(normalizeSource("   ")).toBe(WAITLIST_SOURCE_DEFAULT);
    expect(normalizeSource(undefined)).toBe(WAITLIST_SOURCE_DEFAULT);
    expect(normalizeSource(123)).toBe(WAITLIST_SOURCE_DEFAULT);
  });

  test("trims and keeps a provided source", () => {
    expect(normalizeSource("  site-waitlist ")).toBe("site-waitlist");
  });

  test("caps the length so a hostile client can't stuff the log", () => {
    const long = "x".repeat(MAX_SOURCE_LENGTH + 50);
    expect(normalizeSource(long)).toHaveLength(MAX_SOURCE_LENGTH);
  });
});

describe("isHoneypotTripped", () => {
  test("a filled value is a bot", () => {
    expect(isHoneypotTripped("Acme Corp")).toBe(true);
  });

  test("empty / whitespace / non-string is a human", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped("   ")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
  });
});

describe("parseWaitlistFields", () => {
  test("accepts a valid signup and normalizes it", () => {
    const result = parseWaitlistFields({ email: "  Survivor@Deadrot.com ", source: "  hero " });
    expect(result).toEqual({
      ok: true,
      trap: false,
      signup: { email: "survivor@deadrot.com", source: "hero" },
    });
  });

  test("defaults the source when omitted", () => {
    const result = parseWaitlistFields({ email: "a@b.co" });
    expect(result.ok && result.signup.source).toBe(WAITLIST_SOURCE_DEFAULT);
  });

  test("a tripped honeypot reports success but records nothing real", () => {
    const result = parseWaitlistFields({ email: "a@b.co", honeypot: "spammy" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.trap).toBe(true);
    // The honeypot path never exposes the (possibly bogus) email downstream.
    expect(result.ok && result.signup.email).toBe("");
  });

  test("the honeypot wins even over an invalid email (drop the bot quietly)", () => {
    const result = parseWaitlistFields({ email: "not-an-email", honeypot: "bot" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.trap).toBe(true);
  });

  test("rejects an invalid email with a friendly error", () => {
    const result = parseWaitlistFields({ email: "nope" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/valid email/i);
  });
});
