import type { Faction } from '@shipshitgames/warline'
import { HelpTooltip } from './HelpTooltip'

const FACTION_COLOR: Record<Faction, string> = {
  wardens: '#c1121f',
  pyre: '#ff6a00',
  scourge: '#8bdc1f',
  neutral: '#34343c',
}

const FACTION_ROWS: { faction: Faction; label: string; help: string }[] = [
  {
    faction: 'wardens',
    label: 'Wardens',
    help: 'One of the two human Pact factions. Warden regions generate resources and can be fortified.',
  },
  {
    faction: 'pyre',
    label: 'Pyre',
    help: 'One of the two human Pact factions. Pyre regions generate resources and can be fortified.',
  },
  {
    faction: 'neutral',
    label: 'Neutral / Contested',
    help: 'Unclaimed ground. Deploy can claim it for the selected Pact faction.',
  },
  {
    faction: 'scourge',
    label: 'The Scourge',
    help: 'Enemy-controlled ground. Pressure comes from breaches and lanes; weakened Scourge regions can be recaptured.',
  },
]

export function Legend() {
  return (
    <section className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="font-display text-xs tracking-wide text-ash">
          Legend
        </h2>
        <HelpTooltip label="Explain legend" side="left">
          The legend decodes map colors and overlays. Use it with the map
          tooltip cards to understand what is safe, contested, hidden, or
          actively dangerous.
        </HelpTooltip>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {FACTION_ROWS.map((row) => (
          <div key={row.faction} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 border border-void"
              style={{ backgroundColor: FACTION_COLOR[row.faction] }}
            />
            <span className="text-xs text-ash">{row.label}</span>
            <HelpTooltip label={`Explain ${row.label}`} side="left">
              {row.help}
            </HelpTooltip>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1 border-t border-gunmetal pt-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-toxic" />
          <span className="text-xs text-ash">Active breach (pulses)</span>
          <HelpTooltip label="Explain active breach" side="left">
            A breach is a Scourge source. Active breaches raise pressure in
            their region every tick until operations damage or seal them.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-blood" />
          <span className="text-xs text-ash">Pressure heat ring</span>
          <HelpTooltip label="Explain pressure heat ring" side="left">
            The ring fills as Scourge pressure rises. Human regions fall when
            pressure reaches 100.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-bone">?</span>
          <span className="text-xs text-ash">Unrevealed — run Recon</span>
          <HelpTooltip label="Explain unrevealed sectors" side="left">
            Hidden sectors hide their real name and stats. Select the region
            and run Recon to reveal it.
          </HelpTooltip>
        </div>
      </div>
    </section>
  )
}
