#!/usr/bin/env node

const DEFAULT_TARGET_PROJECTS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
};

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
let lastRateLimit = null;

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

const boardlessIssues = await loadBoardlessOpenIssues();

console.log(
  `Prepared ${existingUpdates.length} existing field update(s) and ${boardlessIssues.length} boardless issue add(s).`,
);

await applyFieldUpdates(existingUpdates, "existing project items");

for (const issue of boardlessIssues) {
  await addIssueToHub(issue, hubProject);
}

if (lastRateLimit) {
  console.log(`GraphQL remaining=${lastRateLimit.remaining} reset=${lastRateLimit.resetAt ?? "unknown"}`);
}

console.log("Board hygiene complete.");

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

function projectNumbersFromEnv(value, fallback) {
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

  for (const option of ["Todo", "In Progress", "Done", "Deferred"]) {
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
          summary: `#${issue.number} ${project.title} Status -> Done`,
        });
      }
    } else if (!existingStatus) {
      updates.push({
        projectId: project.id,
        itemId: item.id,
        fieldId: status.id,
        optionId: statusOptions.get("Todo"),
        summary: `#${issue.number} ${project.title} Status -> Todo`,
      });
    }

    if (!existingPriority) {
      updates.push({
        projectId: project.id,
        itemId: item.id,
        fieldId: priority.id,
        optionId: priorityOptions.get("P3"),
        summary: `#${issue.number} ${project.title} Priority -> P3`,
      });
    }
  }

  return updates;
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

async function loadBoardlessOpenIssues() {
  const boardless = [];
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
                projectItems(first: 25) {
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
      if (issue.projectItems.nodes.length === 0) {
        boardless.push(issue);
      }
    }

    cursor = issueConnection.pageInfo.hasNextPage ? issueConnection.pageInfo.endCursor : null;
  } while (cursor);

  return boardless;
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

  const updates = [
    {
      projectId: hubProject.id,
      fieldId: status.id,
      optionId: optionId(status, "Todo"),
      summary: `#${issue.number} ${hubProject.title} Status -> Todo`,
    },
    {
      projectId: hubProject.id,
      fieldId: priority.id,
      optionId: optionId(priority, "P3"),
      summary: `#${issue.number} ${hubProject.title} Priority -> P3`,
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
