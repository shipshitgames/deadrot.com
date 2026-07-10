#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const DEFAULT_TARGET_PROJECTS = [3, 10];
const DEFAULT_OPEN_STATUS = "Backlog";
const STATUS_OPTIONS = [DEFAULT_OPEN_STATUS, "In Progress", "Done", "Deferred"];

// Agent-routing lane labels. These are execution metadata for picked-up work;
// unassigned/unlabeled open issues can legitimately sit in Backlog.
const LANE_LABELS = ["codex:automation", "claude:routine"];

const config = {
  org: process.env.BOARD_HYGIENE_ORG ?? "shipshitgames",
  repoOwner: process.env.BOARD_HYGIENE_REPO_OWNER ?? "shipshitgames",
  repo: process.env.BOARD_HYGIENE_REPO ?? "deadrot.com",
  hubProjectNumber: numberFromEnv("BOARD_HYGIENE_HUB_PROJECT", 10),
  targetProjects: projectNumbersFromEnv(process.env.BOARD_HYGIENE_PROJECTS, DEFAULT_TARGET_PROJECTS),
  dryRun: boolFromEnv("BOARD_HYGIENE_DRY_RUN", true),
  chunkSize: numberFromEnv("BOARD_HYGIENE_CHUNK_SIZE", 8),
  rateFloor: numberFromEnv("BOARD_HYGIENE_GRAPHQL_RATE_FLOOR", 1500),
  sleepMs: numberFromEnv("BOARD_HYGIENE_SLEEP_MS", 1500),
  laneCheck: boolFromEnv("BOARD_HYGIENE_LANE_CHECK", false),
};

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
let lastRateLimit = null;
const isCli = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isCli) {
  if (!token) {
    throw new Error("Set GITHUB_TOKEN or GH_TOKEN before running board hygiene.");
  }

  console.log(
    [
      `Board hygiene for ${config.repoOwner}/${config.repo}`,
      `projects=${config.targetProjects.join(",")}`,
      `hub=${config.hubProjectNumber}`,
      `dryRun=${config.dryRun}`,
      `chunkSize=${config.chunkSize}`,
      `rateFloor=${config.rateFloor}`,
    ].join(" "),
  );

  const projects = await loadProjects(config.targetProjects);
  const existingUpdates = [];

  for (const project of projects) {
    validateProjectShape(project);
    const updates = collectProjectUpdates(project);
    existingUpdates.push(...updates);

    console.log(
      `Project #${project.number} ${project.title}: ${project.items.length} item(s), ${updates.length} pending field update(s)`,
    );
  }

  const hubProject = projects.find((project) => project.number === config.hubProjectNumber);

  if (!hubProject) {
    throw new Error(`Hub project #${config.hubProjectNumber} is not in BOARD_HYGIENE_PROJECTS.`);
  }

  const { hubless: hublessIssues, laneless: lanelessIssues } = await loadOpenIssues();

  console.log(
    `Prepared ${existingUpdates.length} existing field update(s) and ${hublessIssues.length} hubless issue add(s).`,
  );

  await applyFieldUpdates(existingUpdates, "existing project items");

  for (const issue of hublessIssues) {
    await addIssueToHub(issue, hubProject);
  }

  reportLanelessIssues(lanelessIssues);

  if (lastRateLimit) {
    console.log(`GraphQL remaining=${lastRateLimit.remaining} reset=${lastRateLimit.resetAt ?? "unknown"}`);
  }

  console.log("Board hygiene complete.");
}

function boolFromEnv(name, fallback) {
  const value = process.env[name];

  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function numberFromEnv(name, fallback) {
  const value = process.env[name];

  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got ${value}`);
  }

  return parsed;
}

export function projectNumbersFromEnv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const numbers = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((item) => Number(item));

  if (numbers.some((item) => !Number.isInteger(item))) {
    throw new Error(`BOARD_HYGIENE_PROJECTS must contain project numbers: ${value}`);
  }

  return [...new Set(numbers)].sort((a, b) => a - b);
}

async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });

  updateRateLimitFromHeaders(response.headers);

  const body = await response.json();

  if (!response.ok || body.errors?.length) {
    const details = JSON.stringify(body.errors ?? body, null, 2);
    throw new Error(`GitHub GraphQL request failed: ${details}`);
  }

  return body.data;
}

function updateRateLimitFromHeaders(headers) {
  const remaining = Number(headers.get("x-ratelimit-remaining"));

  if (!Number.isFinite(remaining)) {
    return;
  }

  const resetSeconds = Number(headers.get("x-ratelimit-reset"));
  lastRateLimit = {
    remaining,
    resetAt: Number.isFinite(resetSeconds) ? new Date(resetSeconds * 1000).toISOString() : undefined,
  };
}

function ensureRateBudget(context) {
  if (!lastRateLimit) {
    return;
  }

  if (lastRateLimit.remaining < config.rateFloor) {
    throw new Error(
      `Stopping before ${context}: GraphQL remaining ${lastRateLimit.remaining} is below floor ${config.rateFloor}. Reset at ${lastRateLimit.resetAt ?? "unknown"}.`,
    );
  }
}

async function loadProjects(projectNumbers) {
  const projects = [];

  for (const projectNumber of projectNumbers) {
    projects.push(await loadProject(projectNumber));
  }

  return projects;
}

async function loadProject(projectNumber) {
  const fieldsQuery = `
    query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          number
          title
          closed
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon {
                id
                name
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const fieldsData = await graphql(fieldsQuery, {
    org: config.org,
    number: projectNumber,
  });
  const project = fieldsData.organization?.projectV2;

  if (!project) {
    throw new Error(`Project #${projectNumber} was not found in ${config.org}.`);
  }

  if (project.closed) {
    console.log(`Project #${projectNumber} ${project.title} is closed; skipping.`);
    return { ...project, fields: [], items: [] };
  }

  const items = [];
  let cursor = null;

  do {
    const pageData = await graphql(
      `
        query($org: String!, $number: Int!, $cursor: String) {
          organization(login: $org) {
            projectV2(number: $number) {
              items(first: 100, after: $cursor) {
                nodes {
                  id
                  type
                  content {
                    ... on Issue {
                      id
                      number
                      title
                      state
                      url
                      labels(first: 50) {
                        nodes {
                          name
                        }
                      }
                      repository {
                        nameWithOwner
                      }
                    }
                  }
                  fieldValues(first: 30) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `,
      {
        org: config.org,
        number: projectNumber,
        cursor,
      },
    );

    const itemConnection = pageData.organization.projectV2.items;
    items.push(...itemConnection.nodes);
    cursor = itemConnection.pageInfo.hasNextPage ? itemConnection.pageInfo.endCursor : null;
  } while (cursor);

  return {
    ...project,
    fields: project.fields.nodes,
    items,
  };
}

function validateProjectShape(project) {
  if (project.closed) {
    return;
  }

  const status = singleSelectField(project, "Status");
  const priority = singleSelectField(project, "Priority");

  for (const option of STATUS_OPTIONS) {
    if (!optionId(status, option)) {
      throw new Error(`Project #${project.number} ${project.title} is missing Status option ${option}.`);
    }
  }

  for (const option of ["P0", "P1", "P2", "P3"]) {
    if (!optionId(priority, option)) {
      throw new Error(`Project #${project.number} ${project.title} is missing Priority option ${option}.`);
    }
  }
}

function singleSelectField(project, name) {
  const field = project.fields.find((candidate) => candidate?.name === name && Array.isArray(candidate.options));

  if (!field) {
    throw new Error(`Project #${project.number} ${project.title} is missing ${name}.`);
  }

  return field;
}

function optionId(field, name) {
  return field.options.find((option) => option.name === name)?.id;
}

function collectProjectUpdates(project) {
  if (project.closed) {
    return [];
  }

  const status = singleSelectField(project, "Status");
  const priority = singleSelectField(project, "Priority");
  const statusOptions = new Map(status.options.map((option) => [option.name, option.id]));
  const priorityOptions = new Map(priority.options.map((option) => [option.name, option.id]));
  const updates = [];

  for (const item of project.items) {
    const issue = item.content;

    if (!issue || issue.repository?.nameWithOwner !== `${config.repoOwner}/${config.repo}`) {
      continue;
    }

    const values = singleSelectValues(item);
    const existingStatus = values.get("Status");
    const existingPriority = values.get("Priority");

    if (issue.state === "CLOSED") {
      if (!["Done", "Deferred"].includes(existingStatus)) {
        updates.push({
          projectId: project.id,
          itemId: item.id,
          fieldId: status.id,
          optionId: statusOptions.get("Done"),
          summary: `#${issue.number} ${project.title} Status ${existingStatus ?? "(empty)"} -> Done`,
        });
      }
    } else if (!existingStatus) {
      updates.push({
        projectId: project.id,
        itemId: item.id,
        fieldId: status.id,
        optionId: statusOptions.get(DEFAULT_OPEN_STATUS),
        summary: `#${issue.number} ${project.title} Status (empty) -> ${DEFAULT_OPEN_STATUS}`,
      });
    }

    if (!existingPriority) {
      const targetPriority = priorityForIssue(issue);
      updates.push({
        projectId: project.id,
        itemId: item.id,
        fieldId: priority.id,
        optionId: priorityOptions.get(targetPriority),
        summary: `#${issue.number} ${project.title} Priority (empty) -> ${targetPriority}`,
      });
    }
  }

  return updates;
}

export function priorityForIssue(issue) {
  const labels = issue.labels?.nodes ?? [];
  const labelNames = new Set(labels.map((label) => label.name.toLowerCase()));

  for (const priority of ["P0", "P1", "P2", "P3"]) {
    if (labelNames.has(priority.toLowerCase())) {
      return priority;
    }
  }

  return "P3";
}

function singleSelectValues(item) {
  const values = new Map();

  for (const value of item.fieldValues.nodes) {
    if (value?.field?.name && value.name) {
      values.set(value.field.name, value.name);
    }
  }

  return values;
}

async function loadOpenIssues() {
  const hubless = [];
  const laneless = [];
  let cursor = null;

  do {
    const data = await graphql(
      `
        query($owner: String!, $repo: String!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            issues(first: 100, after: $cursor, states: OPEN, orderBy: { field: CREATED_AT, direction: ASC }) {
              nodes {
                id
                number
                title
                url
                labels(first: 50) {
                  nodes {
                    name
                  }
                }
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                projectItems(first: 50) {
                  nodes {
                    id
                    project {
                      number
                      title
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      {
        owner: config.repoOwner,
        repo: config.repo,
        cursor,
      },
    );

    const issueConnection = data.repository.issues;

    for (const issue of issueConnection.nodes) {
      if (issueNeedsHubProject(issue, config.hubProjectNumber)) {
        hubless.push(issue);
      }

      const labelNames = new Set(issue.labels.nodes.map((label) => label.name));
      const hasLaneLabel = LANE_LABELS.some((name) => labelNames.has(name));
      const hasAssignee = issue.assignees.nodes.length > 0;

      if (!hasLaneLabel && !hasAssignee) {
        laneless.push(issue);
      }
    }

    cursor = issueConnection.pageInfo.hasNextPage ? issueConnection.pageInfo.endCursor : null;
  } while (cursor);

  return { hubless, laneless };
}

export function issueNeedsHubProject(issue, hubProjectNumber) {
  return !issueHasProject(issue, hubProjectNumber);
}

function issueHasProject(issue, projectNumber) {
  return issue.projectItems?.nodes?.some((item) => item.project?.number === projectNumber) ?? false;
}

function reportLanelessIssues(laneless) {
  if (!config.laneCheck) {
    return;
  }

  if (laneless.length === 0) {
    console.log("Lane check: every open issue has a lane label or human assignee.");
    return;
  }

  console.warn(
    `Lane check: ${laneless.length} open issue(s) have no lane label (${LANE_LABELS.join("/")}) and no assignee:`,
  );

  for (const issue of laneless) {
    console.warn(`  - #${issue.number} ${issue.title} ${issue.url}`);
  }
}

async function applyFieldUpdates(updates, label) {
  if (!updates.length) {
    return;
  }

  if (config.dryRun) {
    console.log(`Dry run: would apply ${updates.length} ${label} update(s).`);

    for (const update of updates.slice(0, 25)) {
      console.log(`- ${update.summary}`);
    }

    if (updates.length > 25) {
      console.log(`- ...and ${updates.length - 25} more`);
    }

    return;
  }

  for (let index = 0; index < updates.length; index += config.chunkSize) {
    const chunk = updates.slice(index, index + config.chunkSize);
    ensureRateBudget(`${label} chunk ${index / config.chunkSize + 1}`);

    await graphql(buildFieldUpdateMutation(chunk), buildFieldUpdateVariables(chunk));
    for (const update of chunk) {
      console.log(`- ${update.summary}`);
    }
    console.log(`Applied ${Math.min(index + chunk.length, updates.length)}/${updates.length} ${label} update(s).`);

    if (index + chunk.length < updates.length) {
      await sleep(config.sleepMs);
    }
  }
}

function buildFieldUpdateMutation(updates) {
  const declarations = [];
  const fields = [];

  for (const [index] of updates.entries()) {
    declarations.push(`$project${index}: ID!`);
    declarations.push(`$item${index}: ID!`);
    declarations.push(`$field${index}: ID!`);
    declarations.push(`$option${index}: String!`);
    fields.push(`
      update${index}: updateProjectV2ItemFieldValue(
        input: {
          projectId: $project${index}
          itemId: $item${index}
          fieldId: $field${index}
          value: { singleSelectOptionId: $option${index} }
        }
      ) {
        projectV2Item {
          id
        }
      }
    `);
  }

  return `mutation(${declarations.join(", ")}) { ${fields.join("\n")} }`;
}

function buildFieldUpdateVariables(updates) {
  return Object.fromEntries(
    updates.flatMap((update, index) => [
      [`project${index}`, update.projectId],
      [`item${index}`, update.itemId],
      [`field${index}`, update.fieldId],
      [`option${index}`, update.optionId],
    ]),
  );
}

async function addIssueToHub(issue, hubProject) {
  const status = singleSelectField(hubProject, "Status");
  const priority = singleSelectField(hubProject, "Priority");
  const targetPriority = priorityForIssue(issue);

  const updates = [
    {
      projectId: hubProject.id,
      fieldId: status.id,
      optionId: optionId(status, DEFAULT_OPEN_STATUS),
      summary: `#${issue.number} ${hubProject.title} Status (new) -> ${DEFAULT_OPEN_STATUS}`,
    },
    {
      projectId: hubProject.id,
      fieldId: priority.id,
      optionId: optionId(priority, targetPriority),
      summary: `#${issue.number} ${hubProject.title} Priority (new) -> ${targetPriority}`,
    },
  ];

  if (config.dryRun) {
    console.log(`Dry run: would add #${issue.number} ${issue.title} to hub board.`);
    return;
  }

  ensureRateBudget(`adding #${issue.number} to hub board`);

  const data = await graphql(
    `
      mutation($project: ID!, $content: ID!) {
        addProjectV2ItemById(input: { projectId: $project, contentId: $content }) {
          item {
            id
          }
        }
      }
    `,
    {
      project: hubProject.id,
      content: issue.id,
    },
  );

  const itemId = data.addProjectV2ItemById.item.id;

  await applyFieldUpdates(
    updates.map((update) => ({ ...update, itemId })),
    `new hub item #${issue.number}`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
