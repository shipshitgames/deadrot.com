import type { ResourceBag, ResourceKind } from '@shipshitgames/warline'
import { RESOURCE_KINDS } from '@shipshitgames/warline'
import { HelpTooltip } from './HelpTooltip'

interface ResourceBarProps {
  resources: ResourceBag
  army: number
}

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  scrap: 'SCRAP',
  biomass: 'BIOMASS',
  fuel: 'FUEL',
  intel: 'INTEL',
}

const RESOURCE_ACCENT: Record<ResourceKind, string> = {
  scrap: 'text-bone',
  biomass: 'text-toxic',
  fuel: 'text-hellfire',
  intel: 'text-ash',
}

const RESOURCE_HELP: Record<ResourceKind, string> = {
  scrap: 'Used for Fortify and Muster. Human-held regions generate scrap every tick.',
  biomass:
    'Used to Muster troops. Scourge-held regions and breach-focused operations generate biomass.',
  fuel: 'Used for Fortify and Deploy. Human-held regions and logistics operations generate fuel.',
  intel: 'Used for Recon. Human-held regions generate intel, and failed operations still give a small intel trickle.',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function ResourceBar({ resources, army }: ResourceBarProps) {
  return (
    <section className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="font-display text-xs tracking-wide text-ash">
          Pact War Pool
        </h2>
        <HelpTooltip label="Explain pact war pool" side="left">
          These are shared campaign resources. Commands spend them, operations
          add to them, and the world also generates resources every tick based
          on who controls regions.
        </HelpTooltip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {RESOURCE_KINDS.map((kind) => (
          <div
            key={kind}
            className="flex flex-col border border-gunmetal bg-iron px-2 py-1.5"
          >
            <span className="flex items-center gap-1 font-display text-[0.65rem] tracking-wide text-ash">
              {RESOURCE_LABEL[kind]}
              <HelpTooltip
                label={`Explain ${RESOURCE_LABEL[kind].toLowerCase()}`}
                side="left"
              >
                {RESOURCE_HELP[kind]}
              </HelpTooltip>
            </span>
            <span
              className={`font-mono text-lg leading-tight ${RESOURCE_ACCENT[kind]}`}
            >
              {fmt(resources[kind])}
            </span>
          </div>
        ))}
        <div className="col-span-2 flex items-center justify-between border border-blood bg-iron px-2 py-1.5">
          <span className="flex items-center gap-1 font-display text-[0.65rem] tracking-wide text-blood">
            PACT ARMY
            <HelpTooltip label="Explain pact army" side="left">
              Army strength is created by Muster and some operations. Deploy
              spends army to reduce pressure or claim territory.
            </HelpTooltip>
          </span>
          <span className="font-mono text-lg leading-tight text-bone">
            {fmt(army)}
          </span>
        </div>
      </div>
    </section>
  )
}
