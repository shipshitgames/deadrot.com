import type { GameSlug } from '@shipshitgames/warline'
import { GAME_OPERATIONS } from '@shipshitgames/warline'
import { HelpTooltip } from './HelpTooltip'

interface OpsPanelProps {
  simulate: (game?: GameSlug) => void
}

const GAME_SLUGS: GameSlug[] = [
  'scourge-survivors',
  'deadlane',
  'pactfall',
  'starblight',
  'redline',
  'rothulk',
]

export function OpsPanel({ simulate }: OpsPanelProps) {
  return (
    <section className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-xs tracking-wide text-ash">
            Demo · Operations
          </h2>
          <HelpTooltip label="Explain demo operations" side="left">
            These buttons pretend another game just reported a mission result
            into Warline. They are for testing the shared campaign loop without
            launching the other games.
          </HelpTooltip>
        </div>
        <span className="font-mono text-[0.6rem] text-hellfire">SIMULATE</span>
      </div>
      <p className="mb-2 text-[0.65rem] leading-snug text-ash">
        Each Ship Shit Game reports an operation that credits the shared war.
        Fire one to push the front.
      </p>

      <div className="flex flex-col gap-2">
        {GAME_SLUGS.map((slug) => {
          const meta = GAME_OPERATIONS[slug]
          return (
            <div key={slug} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => simulate(slug)}
                title={meta.blurb}
                className="min-w-0 flex-1 border-2 border-hellfire bg-iron px-2.5 py-1.5 text-left transition-colors hover:bg-hellfire/20"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm tracking-wide text-bone">
                    {meta.label}
                  </span>
                  <span className="font-mono text-[0.6rem] text-hellfire">
                    {slug}
                  </span>
                </span>
                <span className="font-mono text-[0.6rem] text-ash">
                  {meta.kind} → {meta.resources.join(', ')}
                </span>
              </button>
              <div className="flex w-7 shrink-0 items-center justify-center border-2 border-gunmetal bg-iron">
                <HelpTooltip label={`Explain ${meta.label}`} side="left">
                  {meta.blurb} This credits {meta.resources.join(', ')} when
                  the operation succeeds.
                </HelpTooltip>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
