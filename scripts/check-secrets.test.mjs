import { describe, expect, test } from "bun:test";

import { isAllowed, matchingPattern } from "./check-secrets.mjs";

// NOTE: every fake credential below is ASSEMBLED FROM FRAGMENTS at runtime
// (join / concat) so the literal pattern never appears contiguously in this
// file's source — otherwise this very test file would trip the real secret
// scanner, which scans all tracked files line by line. The reconstructed
// runtime values are still valid matches for matchingPattern().
const fakeStripe = ["sk", "live", "abcdefghijklmnopqrstuvwx"].join("_");
const fakeAwsId = `AKIA${"1234567890ABCDEF"}`;
const fakeGithub = ["ghp", "0123456789abcdefghijklmnopqrstuvwxyz"].join("_");

// Regression guard for the over-broad `/ci[_-]?/i` allowlist entry, which
// collapsed to the bare substring "ci" and silently exempted any line that
// merely contained an ordinary word like decision / specific / special.

describe("secret-scanner allowlist is not fooled by 'ci' inside ordinary words", () => {
  test.each([
    ["decision", `const decision = "${fakeStripe}";`],
    ["specific", `// a specific value: ${fakeStripe}`],
    ["special", `aws_secret_access_key=${fakeStripe} <special case>`],
    ["associate", `associate key ${fakeStripe}`],
    ["precise", `precise: ${fakeStripe}`],
    ["ancient", `ancient ${fakeStripe}`],
  ])("a real secret on a line containing %p is still reported", (_word, line) => {
    expect(isAllowed(line)).toBe(false);
    expect(matchingPattern(line)).toBeTruthy();
  });
});

describe("secret-scanner still allows intentional placeholders", () => {
  // The literal `${...}` is the fixture under test (the /\$\{/ allow pattern), not
  // an actual template string — assemble it so it isn't a curly-in-string lint hit.
  const envInterpolationLine = `DB=$${"{DATABASE_URL}"}`;

  test.each([
    ["ci-placeholder marker", "token: ci-placeholder"],
    ["ci_secret marker", "CLERK_SECRET_KEY=ci_secret"],
    ["ci-token marker", "value: ci-token"],
    ["your_ marker", "SOME_KEY=your_key_here"],
    ["example marker", "EXAMPLE_SECRET=example-value"],
    ["env interpolation", envInterpolationLine],
  ])("placeholder line (%s) is allowed", (_label, line) => {
    expect(isAllowed(line)).toBe(true);
  });
});

describe("secret-scanner detects bare credential lines (no exempting word)", () => {
  test.each([
    ["Stripe or Clerk secret key", `const x = ${fakeStripe}`],
    ["AWS access key id", `AWS=${fakeAwsId}`],
    ["GitHub token", `gh = ${fakeGithub}`],
  ])("%p is reported on a bare line", (name, line) => {
    expect(matchingPattern(line)).toBe(name);
  });
});
