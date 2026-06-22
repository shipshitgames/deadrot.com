import { createSocialMetadata } from "@/lib/social";

// Static copy for /community. The live data (builds, feedback URLs, principles)
// is derived in @/lib/community; this module only holds the page's prose so the
// layout in page.tsx stays a pure render.

export const metadata = createSocialMetadata({
  title: "Community",
  description:
    "Every DEADROT game ships as an open preview. Report bugs, pitch ideas, and follow each fix — your feedback steers what we build next.",
  path: "/community",
  openGraphTitle: "DEADROT Community Builds",
});

export const hero = {
  eyebrow: "Open Previews",
  title: "Build It With Us",
  lede: "Every game on deadrot.com ships as an open preview — playable now, rough on purpose, and shaped in the open. Find a bug, float an idea, and watch it become a tracked issue.",
} as const;

export const builds = {
  eyebrow: "The Roster",
  title: "Pick a Build to Break",
  lede: "Each card opens a pre-filled GitHub issue — no account juggling, no forms to mail us. Tell us what broke or what you'd change, and it lands as a labelled report we work from.",
} as const;

export const principles = {
  eyebrow: "How This Works",
  title: "The Contributor Pact",
} as const;
