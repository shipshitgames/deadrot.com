import type { Command, CommandKind, HumanFaction, Region, WorldState } from "@shipshitgames/warline";
import { canAfford, COMMAND_COSTS, regionById } from "@shipshitgames/warline";
import { HelpTooltip } from "./HelpTooltip";

interface CommandPanelProps {
  state: WorldState;
  faction: HumanFaction;
  setFaction: (f: HumanFaction) => void;
  selectedId: string | null;
  command: (cmd: Command) => void;
}

interface CommandDef {
  kind: CommandKind;
  label: string;
  needsRegion: boolean;
  hint: string;
  help: string;
}

const COMMANDS: CommandDef[] = [
  {
    kind: "fortify",
    label: "Fortify",
    needsRegion: true,
    hint: "+defense, −pressure on a held region",
    help: "Spend scrap and fuel on a Pact-held region. It raises defense and lowers Scourge pressure there.",
  },
  {
    kind: "muster",
    label: "Muster",
    needsRegion: false,
    hint: "+army strength",
    help: "Spend biomass and scrap to add Pact Army. You need army before Deploy can recapture or claim territory.",
  },
  {
    kind: "deploy",
    label: "Deploy",
    needsRegion: true,
    hint: "−pressure; recapture scourge / claim neutral",
    help: "Spend fuel and Pact Army on the selected region. It reduces pressure, claims neutral regions, and can recapture weakened Scourge regions.",
  },
  {
    kind: "recon",
    label: "Recon",
    needsRegion: true,
    hint: "reveal an unknown sector",
    help: "Spend intel on a selected region to reveal hidden Scourge territory and show its real name and stats.",
  },
];

function costLabel(kind: CommandKind): string {
  const cost = COMMAND_COSTS[kind];
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if (typeof v === "number") parts.push(`${v} ${k}`);
  }
  return parts.join(" · ");
}

const FACTIONS: HumanFaction[] = ["pyre", "wardens"];

function isHuman(r: Region): boolean {
  return r.faction === "pyre" || r.faction === "wardens";
}

export function CommandPanel({ state, faction, setFaction, selectedId, command }: CommandPanelProps) {
  const selected = selectedId ? regionById(state, selectedId) : undefined;

  function disabledReason(def: CommandDef): string | null {
    if (!canAfford(state, def.kind)) return "Insufficient resources";
    if (def.needsRegion && !selected) return "Select a region";
    if (def.kind === "fortify" && selected && !isHuman(selected)) return "Region not held by the Pact";
    return null;
  }

  function run(def: CommandDef) {
    if (disabledReason(def)) return;
    if (def.kind === "muster") {
      command({ kind: "muster", faction });
      return;
    }
    if (!selected) return;
    if (def.kind === "fortify") command({ kind: "fortify", regionId: selected.id, faction });
    else if (def.kind === "deploy") command({ kind: "deploy", regionId: selected.id, faction });
    else if (def.kind === "recon") command({ kind: "recon", regionId: selected.id, faction });
  }

  return (
    <section className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="font-display text-xs tracking-wide text-ash">Command</h2>
        <HelpTooltip label="Explain command panel" side="left">
          This is the open action panel. Pick the faction you are acting for, select a map region when needed, then
          spend shared resources to push the front back.
        </HelpTooltip>
      </div>

      {/* faction toggle */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="font-display text-[0.6rem] tracking-wide text-ash">Acting Faction</span>
        <HelpTooltip label="Explain acting faction" side="left">
          Pyre and Wardens are both Pact factions. This only decides who gets credited in the war feed when you issue
          commands.
        </HelpTooltip>
      </div>
      <div className="mb-3 flex border-2 border-gunmetal">
        {FACTIONS.map((f) => {
          const active = f === faction;
          const activeClass = f === "pyre" ? "bg-hellfire text-bone" : "bg-blood text-bone";
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFaction(f)}
              className={`flex-1 px-2 py-1.5 font-display text-xs tracking-wide transition-colors ${
                active ? activeClass : "bg-iron text-ash hover:text-bone"
              }`}
              style={active ? { boxShadow: "var(--shadow-ember)" } : undefined}
            >
              {f.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* selected region */}
      <div className="mb-3 border border-gunmetal bg-iron px-2 py-1.5">
        <span className="flex items-center gap-1 font-display text-[0.6rem] tracking-wide text-ash">
          Selected Region
          <HelpTooltip label="Explain selected region" side="left">
            Most commands need a target. Click a node on the map to load its faction, pressure, and defense here.
          </HelpTooltip>
        </span>
        {selected ? (
          <div className="mt-0.5">
            <p className="font-display text-sm text-bone">{selected.name}</p>
            <p className="font-mono text-[0.65rem] text-ash">
              {selected.faction} · P {Math.round(selected.pressure)} · D {Math.round(selected.defense)}
            </p>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-ash">None — click the map</p>
        )}
      </div>

      {/* command buttons */}
      <div className="flex flex-col gap-2">
        {COMMANDS.map((def) => {
          const reason = disabledReason(def);
          const disabled = reason !== null;
          return (
            <div key={def.kind} className="flex items-stretch gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => run(def)}
                title={reason ?? def.hint}
                className={`min-w-0 flex-1 border-2 px-2.5 py-1.5 text-left transition-colors ${
                  disabled
                    ? "cursor-not-allowed border-gunmetal bg-iron opacity-50"
                    : "border-blood bg-iron hover:bg-blood/20"
                }`}
              >
                <span className="flex flex-col">
                  <span className="font-display text-sm tracking-wide text-bone">{def.label}</span>
                  <span className="font-mono text-[0.6rem] text-ash">{costLabel(def.kind)}</span>
                </span>
              </button>
              <div className="flex w-7 shrink-0 items-center justify-center border-2 border-gunmetal bg-iron">
                <HelpTooltip label={`Explain ${def.label}`} side="left">
                  {reason ? `${reason}. ` : ""}
                  {def.help}
                </HelpTooltip>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
