---
name: lore-craft
description: >-
  Write and rewrite Ship Shit Games canon lore with real literary craft and the house voice,
  and diagnose/fix "lazy" spec-sheet prose. Use this whenever creating, editing, or reviewing
  any entry in the lore vault (Bestiary, Characters, Locations, Factions, Games, Universe) —
  whenever a lore page reads like a stat block or wiki stub, whenever you're about to write
  a new creature/character/location/faction, or whenever the user says lore "feels lazy,"
  "generic," "flat," or wants it to "sound better." Pairs with the humanizer skill (which
  strips AI tells); this one supplies the affirmative voice and craft.
---

# Lore Craft — writing canon that doesn't read like a spec sheet

The Ship Shit Games vault keeps slipping into **spec-sheet prose**: bullet lists of
"Behaviour / Visual Motifs / Prompt Seed," generic intensifiers ("brutal," "lethal,"
"tougher mutated variants"), and sentences shaped *"It is X. It does Y. It can Z."* That's
fine for a wiki. It is not lore. Lore makes a reader *feel* the world — through a specific
moment, seen by someone who was there, in a voice that could only be this universe.

This skill is how you write the narrative parts well. It does **not** replace the practical
game-spec sections (those are useful) — it fixes the *prose around them* and keeps the two
registers from bleeding into each other.

## Non-negotiables first

1. **Read `CANON.md` and obey `## Locked`.** Voice never overrides canon. If a vivid line
   would contradict a locked fact, the line is wrong, not the canon.
2. **Read `Universe/Style-Bible.md` and `DESIGN.md`** for the look and tone before writing.
3. **Stay in the house voice** (below). A beautiful sentence in the wrong voice is still off.

## The house voice

From the Style-Bible, distilled into how it *sounds on the page*:

- **DOOM's gore, Blizzard's cohesion.** Viscera and rust, but everything connects to one
  coherent world. Gore is never random — it means something happened here.
- **Brutal, fast, gallows-humor.** Short hard sentences. Soldiers who joke because the
  alternative is screaming. "shipshitshow energy" — streamable, quotable, grim-funny.
- **Hard, short, ominous naming.** Kill-architecture and decay: *the Choir, breaches, lanes,
  Purgers, the Pyre, Perdition.* No soft fantasy syllables, no Latinate sprawl.
- **Blood + fire + metal + bone. Toxic-green is the Scourge only.** Never neon, never clean
  sci-fi. If a description doesn't smell like blood on gunmetal, it's the wrong description.
- **Restraint reads as confidence.** The world is grim enough that you don't need to oversell
  it. Understatement and a single exact detail hit harder than three adjectives.

## The laziness diagnostic

Run a draft (yours or an existing entry) against these. Each "yes" is a rewrite target.
This is a *diagnostic* lens, like a code smell — not every flag must be fixed, but each one
is the prose telling you it took the easy path.

- **Generic intensifiers** doing the work a concrete image should: *brutal, lethal, fast,
  tougher, monstrous, relentless, deadly.* These are claims, not pictures. Replace with the
  thing that makes them true.
- **List-prose / "stat block in sentences":** *"It is X. It does Y. It can Z."* Strings of
  capability statements with no scene, no consequence, no one watching.
- **Telling, not showing:** stating an effect ("it's terrifying," "forces repositioning")
  instead of rendering it so the reader concludes it themselves.
- **No in-world POV:** nobody in the fiction has ever seen this thing. Lore gains weight when
  it's filtered through someone who *survived* it (or didn't).
- **No specific incident:** all general ("often," "tends to," "usually"). One named event,
  one wall, one bad night, beats a hundred "usually"s.
- **Repeated sentence shape:** every sentence the same length and rhythm (often every line
  starting "Advances… / Charges… / Ignores…"). Monotony reads as a machine filling a form.
- **Off-voice clichés:** standard-issue sci-fi/fantasy phrasing ("ancient evil," "tendrils
  of darkness," "unspeakable horror," "a force to be reckoned with"). This world is too
  specific for stock parts.

If you want the *mechanical* AI tells (em-dash tics, "it's not just X, it's Y," hedging,
rule-of-three padding) cleaned too, run the **humanizer** skill after. This skill is the
voice; humanizer is the polish.

## The craft moves (what to do instead)

- **Trade an adjective for a detail.** Don't say it's frightening; show the seam-light
  bleeding green and let the reader supply the fear. Concrete nouns and verbs over modifiers.
- **Anchor in a witness.** Even one clause of POV — *"A Warden gunner gets one good look
  before…"* — turns a description into an experience. Use the factions, the Purgers, the
  dead.
- **Give it one true incident.** A wall that fell on a specific night, a Purger who came back
  wrong, a lane that's never broken. Specifics imply a whole history; generalities imply
  nothing.
- **Vary the rhythm.** Mix a long, accumulating sentence against a three-word gut-punch.
  Grim humor lands in the turn between them.
- **Cut to the bone.** Delete the second and third adjective. Delete the sentence that
  restates the previous one. Restraint is the voice.
- **Earn the gore.** Viscera should carry information — what it ate, how long the breach has
  fed, who used to own that carapace.

## Two audiences, two layers (keep them separate)

This vault is read by two audiences at once, and they want opposite things:

- **Players / humans** read for **voice** — tone, story, the feeling of the world. This is the
  entry's narrative body and the intro: in-world, witnessed, concrete. All the craft above
  applies here. It's also the seed of in-game codex and marketing text.
- **Agents / devs** read for **definitions** — they pull this vault as submodule memory to
  build the games, so they need facts they can lift without parsing prose: rich frontmatter, a
  one-line **At a glance** digest under the title, and the terse spec blocks (`Gameplay Read`,
  `Sprite Brief`, `Prompt Seed`). **Leave those terse.** Don't novelize a Prompt Seed; don't
  bullet-point the lore.

And `CANON.md` is pure **definitions** — the rulebook. Never write it in narrative voice.

The mistake the vault keeps making is writing the *narrative* sections in spec-sheet style —
that loses the player. The opposite mistake is burying a hard fact inside a paragraph so a dev
has to mine for it — that loses the agent. **Voice on top, facts underneath, never blended.**

**At a glance** — one line directly under the `#` title, so both readers orient instantly and
an agent can grab the canon facts in one grep:

`**At a glance:** <type / role> · <key trait> · <key trait> · appears in [[Game]] / [[Game]].`

## Before / after (real entries)

These use actual vault text so the transformation is concrete.

**Example 1 — `Bestiary/Render.md`, the "Behaviour" framing.**

Lazy (capability list, telling, no witness):
> Charges the nearest fortified position or high-value target in a straight line — no
> flanking, no hesitation. At half health the parasite purges restraint organelles: speed
> and ferocity spike hard.

Crafted (witness + concrete + voice; spec kept for the bullet list elsewhere):
> A Warden gunner gets one clean look at a Render before it reaches the wall: low, wide,
> moving faster than that much shell has any right to, green light bleeding from the cracks
> of a carapace that used to belong to something with a name. Shoot it enough and it stops
> slowing down. That's the tell. The thing the parasite was holding back lets go, and the
> last forty feet happen in about a second and a half.

**Example 2 — `Bestiary/Rot-Engine.md`, the opening line.**

Lazy (generic noun-stack, no world):
> A Machine-Graft Scourge elite — the chassis of a conquered heavy machine, split at its
> welds and rebuilt by parasite tissue into a siege-scale tower-cracker.

Crafted (specific image, restraint, implied history):
> It was a hauler once — you can still read the load rating stencilled under the rust. Now
> the cab is hollow, the engine block is a sac of toxic-green bile, and it walks up a lane at
> the pace of a funeral, dissolving everything the Wardens built one wall at a time.

Note what changed: a *recognizable object* (a hauler with a stencil), the gore carrying
information (the hollow cab, the bile sac), a rhythm that ends on a grim, quotable image,
and zero intensifiers. Same facts. Real voice.

## Workflow for rewriting an entry

1. Read `CANON.md`, `Style-Bible.md`, and the entry. Note the locked facts it must keep.
2. Run the **laziness diagnostic** over its narrative sections; mark the flags.
3. Rewrite the narrative sections only — trade adjectives for details, add a witness, give it
   one true incident, vary the rhythm, cut to the bone. Keep every canon fact.
4. Add or refresh the **At a glance** line under the title so the agent layer is intact.
5. Leave `Gameplay Read` / `Sprite Brief` / `Prompt Seed` / frontmatter terse and intact
   (fix factual drift, don't novelize them).
6. Optional: run **humanizer** to strip residual AI tells.
7. Sanity-check against CANON one more time before saving.

## When generating a brand-new entry

Same voice, same diagnostic — but lead with the *fiction*, not the form. Before filling the
template, answer in one or two sentences: **who has met this and lived, and what was the
worst part?** Write that first. The template sections hang off that core; they don't replace
it.
