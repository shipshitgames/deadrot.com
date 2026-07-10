import { describe, expect, test } from "bun:test";

import {
  DEFAULT_TARGET_PROJECTS,
  issueNeedsHubProject,
  priorityForIssue,
  projectNumbersFromEnv,
} from "./board-hygiene.mjs";

function issueOnProjects(projectNumbers) {
  return {
    projectItems: {
      nodes: projectNumbers.map((number) => ({
        project: { number },
      })),
    },
  };
}

function issueWithLabels(labelNames) {
  return {
    labels: {
      nodes: labelNames.map((name) => ({ name })),
    },
  };
}

describe("board hygiene target projects", () => {
  test("defaults to the live hub plus Lore as the only secondary board", () => {
    expect(DEFAULT_TARGET_PROJECTS).toEqual([3, 10]);
  });

  test("keeps explicit overrides sorted and unique", () => {
    expect(projectNumbersFromEnv("10,3 10", [])).toEqual([3, 10]);
  });
});

describe("board hygiene hub membership", () => {
  test("requires explicit Project #10 membership", () => {
    expect(issueNeedsHubProject(issueOnProjects([1, 3, 5]), 10)).toBe(true);
    expect(issueNeedsHubProject(issueOnProjects([3]), 10)).toBe(true);
    expect(issueNeedsHubProject(issueOnProjects([]), 10)).toBe(true);
  });

  test("does not re-add issues already on Project #10", () => {
    expect(issueNeedsHubProject(issueOnProjects([10]), 10)).toBe(false);
    expect(issueNeedsHubProject(issueOnProjects([1, 10]), 10)).toBe(false);
  });
});

describe("board hygiene priority", () => {
  test("uses explicit issue priority labels for missing project priority fields", () => {
    expect(priorityForIssue(issueWithLabels(["enhancement", "p0"]))).toBe("P0");
    expect(priorityForIssue(issueWithLabels(["P1"]))).toBe("P1");
    expect(priorityForIssue(issueWithLabels(["design-assets-arch", "p2"]))).toBe("P2");
  });

  test("defaults unlabeled issues to P3", () => {
    expect(priorityForIssue(issueWithLabels(["enhancement"]))).toBe("P3");
    expect(priorityForIssue({})).toBe("P3");
  });
});
