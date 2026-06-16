import { type Accent, type GameStatus, games } from "@/lib/content";

export interface StoryBeat {
  title: string;
  body: string;
}

export interface SeasonOneSpine {
  kicker: string;
  title: string;
  lede: string;
  beats: StoryBeat[];
  close: string;
}

export const SEASON_ONE: SeasonOneSpine = {
  kicker: "Season One",
  title: "Join the Front",
  lede: "We lost the sky on Zero Day. Now the Scourge tears back in through breaches that never stop vomiting horde, and the only thing between it and extinction is the lanes — and the people still holding them.",
  beats: [
    {
      title: "One war, many fronts",
      body: "Every Deadrot game is a single operation in the same war: purge a breach, hold a lane, intercept the rot in orbit, run a message through the dark. Warline is the console that ties them together.",
    },
    {
      title: "The front opens in waves",
      body: "Games unlock one at a time as the season advances — each new build is another front coming online, not a disconnected prototype. Early access is a seat on the wall before the next one opens.",
    },
    {
      title: "Forged live, with you",
      body: "Every map, monster, and sprite is built on stream, and community builds and feedback steer what ships next. Join now and you shape the war instead of just watching it.",
    },
  ],
  close: "DOOM's gore with Blizzard's cohesion — one persistent war you help fight and help build.",
};

export interface FrontOperation {
  slug: string;
  title: string;
  accent: Accent;
  status: GameStatus;
  operation: string;
  line: string;
}

/** The front's operations, one per game, in the same order as the catalog. */
export const frontOperations: FrontOperation[] = games.map((g) => ({
  slug: g.slug,
  title: g.title,
  accent: g.accent,
  status: g.status,
  operation: g.warlineRole.operation,
  line: g.warlineRole.line,
}));
