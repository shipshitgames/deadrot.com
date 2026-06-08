import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://deadrot.com";

const gameEntries = [
  {
    slug: "deadlane",
    title: "DEADLANE - DEADROT",
    description:
      "Hold the lane as the Wardens. Build, wall, and bleed the Scourge dry before the breach reaches the line.",
    image: `${siteOrigin}/images/og/games/deadlane.png`,
  },
  {
    slug: "pactfall",
    title: "PACTFALL - DEADROT",
    description:
      "Settle the Pyre and Warden grudge in the arena, but do not let the Pact break while the Scourge surges.",
    image: `${siteOrigin}/images/og/games/pactfall.png`,
  },
  {
    slug: "redline",
    title: "REDLINE - DEADROT",
    description: "Outrun the Choir as a courier on dead roads. Keep the redline or the Scourge swarm catches up.",
    image: `${siteOrigin}/images/og/games/redline.png`,
  },
  {
    slug: "rothulk",
    title: "ROTHULK - DEADROT",
    description:
      "Climb a living Scourge bio-hulk, ignite its breach-core, and escape before the severed node collapses.",
    image: `${siteOrigin}/images/og/games/rothulk.png`,
  },
  {
    slug: "scourge-survivors",
    title: "Scourge Survivors - DEADROT",
    description: "Drop into the breach as a Pyre operator, survive the Scourge swarm, draft upgrades, and burn deeper.",
    image: `${siteOrigin}/images/og/games/scourge-survivors.png`,
  },
  {
    slug: "starblight",
    title: "STARBLIGHT - DEADROT",
    description:
      "Burn Scourge infection out of orbit before spores, wreckage, and carrier-ships fall into the ground war.",
    image: `${siteOrigin}/images/og/games/starblight.png`,
  },
  {
    slug: "warline",
    title: "Warline - DEADROT",
    description:
      "Manage the War for the Lanes, spend shared resources, fortify regions, and push back the Scourge front.",
    image: `${siteOrigin}/images/hero.webp`,
  },
];

const webSourceChecks = [
  {
    file: "apps/web/app/layout.tsx",
    contains: ["DEFAULT_SOCIAL_IMAGE", "openGraph:", "twitter:", 'canonical: "/"'],
  },
  {
    file: "apps/web/app/docs/page.tsx",
    contains: ["createSocialMetadata", "DEADROT Docs", 'path: "/docs"'],
  },
  {
    file: "apps/web/app/universe/page.tsx",
    contains: ["createSocialMetadata", "The DEADROT Universe", 'path: "/universe"'],
  },
  {
    file: "apps/web/app/games/[slug]/page.tsx",
    contains: ["createSocialMetadata", "images/og/games", "path: `/games/", "game.slug}`"],
  },
  {
    file: "apps/web/app/characters/[slug]/page.tsx",
    contains: ["createEntitySocialMetadata", "path: `/characters/", "character.slug}`", 'kind: "Dossier"'],
  },
  {
    file: "apps/web/app/factions/[slug]/page.tsx",
    contains: ["createEntitySocialMetadata", "path: `/factions/", "faction.slug}`", 'kind: "Faction"'],
  },
  {
    file: "apps/web/app/bestiary/[slug]/page.tsx",
    contains: ["createEntitySocialMetadata", "path: `/bestiary/", "creature.slug}`", 'kind: "Bestiary"'],
  },
];

const failures = [];

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function fail(message) {
  failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMetaTag(head, attr, key) {
  const re = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escapeRegExp(key)}["'])[^>]*>`, "i");
  return head.match(re)?.[0] ?? null;
}

function getLinkTag(head, relValue) {
  const re = new RegExp(`<link\\b(?=[^>]*\\brel=["']${escapeRegExp(relValue)}["'])[^>]*>`, "i");
  return head.match(re)?.[0] ?? null;
}

function getAttr(tag, attr) {
  const re = new RegExp(`\\b${attr}=["']([^"']+)["']`, "i");
  return tag.match(re)?.[1] ?? "";
}

function publicPathFromSiteUrl(value) {
  const url = new URL(value);
  if (url.origin !== siteOrigin) {
    throw new Error(`expected ${value} to use ${siteOrigin}`);
  }
  return path.join(repoRoot, "apps/web/public", decodeURIComponent(url.pathname.slice(1)));
}

async function assertReadableFile(filePath, label) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) {
      fail(`${label} is missing or empty: ${rel(filePath)}`);
    }
  } catch {
    fail(`${label} is missing: ${rel(filePath)}`);
  }
}

async function checkGameEntry(entry) {
  const htmlPath = path.join(repoRoot, "apps/games", entry.slug, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) {
    fail(`${rel(htmlPath)} has no <head> block`);
    return;
  }

  const expected = [
    ["name", "description", entry.description],
    ["property", "og:title", entry.title],
    ["property", "og:description", entry.description],
    ["property", "og:url", `${siteOrigin}/${entry.slug}/`],
    ["property", "og:image", entry.image],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", entry.title],
    ["name", "twitter:description", entry.description],
    ["name", "twitter:image", entry.image],
  ];

  for (const [attr, key, value] of expected) {
    const tag = getMetaTag(head, attr, key);
    if (!tag) {
      fail(`${rel(htmlPath)} is missing ${attr}="${key}"`);
      continue;
    }
    const content = getAttr(tag, "content");
    if (content !== value) {
      fail(`${rel(htmlPath)} ${key} content mismatch: expected "${value}", got "${content}"`);
    }
  }

  const canonical = getLinkTag(head, "canonical");
  if (!canonical) {
    fail(`${rel(htmlPath)} is missing canonical link`);
  } else {
    const href = getAttr(canonical, "href");
    const expectedHref = `${siteOrigin}/${entry.slug}/`;
    if (href !== expectedHref) {
      fail(`${rel(htmlPath)} canonical mismatch: expected "${expectedHref}", got "${href}"`);
    }
  }

  await assertReadableFile(publicPathFromSiteUrl(entry.image), `${entry.slug} social image`);
}

async function checkNoUnlistedGameEntries() {
  const gamesDir = path.join(repoRoot, "apps/games");
  const entriesWithHtml = [];
  for (const dirent of await readdir(gamesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const indexPath = path.join(gamesDir, dirent.name, "index.html");
    try {
      await stat(indexPath);
      entriesWithHtml.push(dirent.name);
    } catch {
      // Package without a standalone HTML entry.
    }
  }

  const expected = new Set(gameEntries.map((entry) => entry.slug));
  for (const slug of entriesWithHtml) {
    if (!expected.has(slug)) {
      fail(`apps/games/${slug}/index.html exists but is not covered by scripts/check-social-metadata.mjs`);
    }
  }
}

async function checkWebSources() {
  const helperPath = path.join(repoRoot, "apps/web/lib/social.ts");
  const helper = await readFile(helperPath, "utf8");
  for (const token of ["DEFAULT_SOCIAL_IMAGE", "summary_large_image", "openGraph:", "twitter:"]) {
    if (!helper.includes(token)) {
      fail(`${rel(helperPath)} is missing "${token}"`);
    }
  }

  await assertReadableFile(path.join(repoRoot, "apps/web/public/images/hero.webp"), "default social image");

  for (const check of webSourceChecks) {
    const filePath = path.join(repoRoot, check.file);
    const source = await readFile(filePath, "utf8");
    for (const token of check.contains) {
      if (!source.includes(token)) {
        fail(`${check.file} is missing "${token}"`);
      }
    }
  }
}

async function checkQuartzSocialImages() {
  const configPath = path.join(repoRoot, "apps/lore/quartz.config.ts");
  const headPath = path.join(repoRoot, "apps/lore/quartz/components/Head.tsx");
  const emitterPath = path.join(repoRoot, "apps/lore/quartz/plugins/emitters/ogImage.tsx");
  const [config, head, emitter] = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(headPath, "utf8"),
    readFile(emitterPath, "utf8"),
  ]);

  for (const token of ['baseUrl: "lore.deadrot.com"', "Plugin.CustomOgImages()"]) {
    if (!config.includes(token)) {
      fail(`${rel(configPath)} is missing "${token}"`);
    }
  }

  for (const token of ["twitter:card", "og:url", "twitter:url"]) {
    if (!head.includes(token)) {
      fail(`${rel(headPath)} is missing "${token}"`);
    }
  }

  for (const token of ['property="og:image"', 'name="twitter:image"', "og:image:width", "og:image:height"]) {
    if (!emitter.includes(token)) {
      fail(`${rel(emitterPath)} is missing "${token}"`);
    }
  }
}

await checkNoUnlistedGameEntries();
await Promise.all(gameEntries.map(checkGameEntry));
await checkWebSources();
await checkQuartzSocialImages();

if (failures.length > 0) {
  console.error("Social metadata check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Social metadata check passed: ${gameEntries.length} game apps, ${webSourceChecks.length} web route files, Quartz OG image output.`,
);
