import assert from "node:assert/strict";
import { test } from "node:test";

import type { GameSlug } from "@shipshitgames/warline";
import { type CompleteRunInput, completeRun, createRunNonce, normalizeRunCompletion } from "../src/warline/completeRun";
import type { WarlineReportOutcome, WarlineRunInput } from "../src/warline/reporter";

test("createRunNonce produces distinct game-scoped keys", () => {
  const first = createRunNonce("brawl");
  const second = createRunNonce("brawl");
  assert.match(first, /^brawl:/);
  assert.notEqual(first, second);
});

test("normalizeRunCompletion preserves each game's existing record and Warline mapping", async () => {
  const cases: Array<{ game: GameSlug; input: CompleteRunInput; local: object; remote: object }> = [
    {
      game: "brawl",
      input: { outcome: "victory", score: 915, timeMs: 22_000, bossKill: true, nonce: "brawl-run" },
      local: { outcome: "victory", score: 915, timeMs: 22_000, bossKill: true },
      remote: { outcome: "victory", score: 915, nonce: "brawl-run" },
    },
    {
      game: "deadlane",
      input: { outcome: "defeat", score: 41, wave: 6, nonce: "deadlane-run" },
      local: { outcome: "defeat", score: 41, wave: 6 },
      remote: { outcome: "defeat", score: 41, nonce: "deadlane-run" },
    },
    {
      game: "pactfall",
      input: { outcome: "victory", score: 320, timeMs: 47_000, bossKill: true, nonce: "pactfall-run" },
      local: { outcome: "victory", score: 320, timeMs: 47_000, bossKill: true },
      remote: { outcome: "victory", score: 320, nonce: "pactfall-run" },
    },
    {
      game: "redline",
      input: { outcome: "victory", score: 1_900, timeMs: 31_000, nonce: "redline-run" },
      local: { outcome: "victory", score: 1_900, timeMs: 31_000 },
      remote: { outcome: "victory", score: 1_900, nonce: "redline-run" },
    },
    {
      game: "rothulk",
      input: { outcome: "defeat", score: 3, timeMs: 38_000, wave: 2, nonce: "rothulk-run" },
      local: { outcome: "defeat", score: 3, timeMs: 38_000, wave: 2 },
      remote: { outcome: "defeat", score: 3, nonce: "rothulk-run" },
    },
    {
      game: "starblight",
      input: { outcome: "victory", score: 7, bossKill: true, nonce: "starblight-run" },
      local: { outcome: "victory", score: 7, bossKill: true },
      remote: { outcome: "victory", score: 7, nonce: "starblight-run" },
    },
    {
      game: "scourge-survivors",
      input: {
        outcome: "victory",
        score: 1_240,
        wave: 9,
        bossKill: 2,
        contributed: 480,
        nonce: "survivors-run",
      },
      local: { outcome: "victory", score: 1_240, wave: 9, bossKill: 2 },
      remote: { outcome: "victory", score: 1_240, contributed: 480, nonce: "survivors-run" },
    },
  ];

  for (const { game, input, local, remote } of cases) {
    assert.deepEqual(normalizeRunCompletion(input), { local, remote });
    const recorded: Array<{ slug: string; result: object }> = [];
    const reported: WarlineRunInput[] = [];
    const completed = completeRun(game, input, {
      now: 7,
      record: (slug, result) => {
        recorded.push({ slug, result });
        return {};
      },
      report: async (_slug, run) => {
        reported.push(run);
        return { reported: true, status: "ok" };
      },
    });
    assert.deepEqual(recorded, [{ slug: game, result: local }]);
    assert.deepEqual(reported, [remote]);
    assert.equal((await completed.reporting)?.status, "ok");
  }
});

test("completeRun records and reports once for a stable game nonce", async () => {
  const recorded: Array<{ slug: string; result: object; now: number }> = [];
  const reported: WarlineRunInput[] = [];
  const report = async (_game: GameSlug, run: WarlineRunInput): Promise<WarlineReportOutcome> => {
    reported.push(run);
    return { reported: true, status: "ok" };
  };
  const input: CompleteRunInput = {
    outcome: "victory",
    score: 120,
    wave: 4,
    contributed: 30,
    nonce: "once-per-run-test",
  };
  const options = {
    now: 42,
    record: (slug: string, result: object, now: number) => {
      recorded.push({ slug, result, now });
      return {};
    },
    report,
  };

  const first = completeRun("scourge-survivors", input, options);
  const repeat = completeRun("scourge-survivors", input, options);

  assert.equal(first.completed, true);
  assert.equal(repeat.completed, false);
  assert.deepEqual(recorded, [
    { slug: "scourge-survivors", result: { outcome: "victory", score: 120, wave: 4 }, now: 42 },
  ]);
  assert.deepEqual(reported, [{ outcome: "victory", score: 120, contributed: 30, nonce: "once-per-run-test" }]);
  assert.deepEqual(await first.reporting, { reported: true, status: "ok" });
});

test("a missing Warline host is a completed local run with a disabled report", async () => {
  let recorded = 0;
  const completed = completeRun(
    "redline",
    { outcome: "defeat", nonce: "missing-host-test" },
    {
      host: "   ",
      record: () => {
        recorded += 1;
        return {};
      },
    },
  );

  assert.equal(completed.completed, true);
  assert.equal(recorded, 1);
  assert.deepEqual(await completed.reporting, {
    reported: false,
    status: "disabled",
    result: { game: "redline", faction: "wardens", outcome: "defeat", score: 0, nonce: "missing-host-test" },
  });
});

test("a rejecting report cannot interrupt completion after the local record", async () => {
  let recorded = 0;
  const completed = completeRun(
    "rothulk",
    { outcome: "defeat", score: 5, nonce: "rejecting-report-test" },
    {
      record: () => {
        recorded += 1;
        return {};
      },
      report: () => {
        throw new Error("front offline");
      },
    },
  );

  assert.equal(completed.completed, true);
  assert.equal(recorded, 1);
  const report = await completed.reporting;
  assert.equal(report?.status, "error");
  assert.match(report?.error ?? "", /front offline/);
});
