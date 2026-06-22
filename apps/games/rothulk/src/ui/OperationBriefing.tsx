import { OPERATION_LINE, OPERATION_NAME, SABOTAGE_BEATS } from "../game/data/operation";

interface OperationBriefingProps {
  /** Hidden on the splash; revealed with the main-menu nav. */
  hidden?: boolean;
}

/**
 * Pre-run mission briefing for Rothulk's Warline operation (#364).
 *
 * Render-pure surface for the canon Breach Sabotage frame: the operation name +
 * line come from the typed lore (games.json `warlineRole`), and the three beats
 * (ignite → collapse → escape) are tied to Choir isolation (CANON §5/§6) and the
 * Warline sabotage report. No state, no game coupling — it reads the static
 * `operation` data module. A `pointer-events: none` fixed panel so it never
 * intercepts the menu's buttons.
 */
export function OperationBriefing({ hidden }: OperationBriefingProps) {
  return (
    <section className="op-briefing" aria-label={`${OPERATION_NAME} briefing`} hidden={hidden}>
      <header className="op-briefing-head">
        <span className="op-briefing-op">{OPERATION_NAME}</span>
        <span className="op-briefing-tag">WARLINE OP</span>
      </header>
      <p className="op-briefing-line">{OPERATION_LINE}</p>
      <ol className="op-briefing-beats">
        {SABOTAGE_BEATS.map((beat, index) => (
          <li key={beat.id} className="op-briefing-beat">
            <span className="op-briefing-step" aria-hidden="true">
              {index + 1}
            </span>
            <span className="op-briefing-beat-body">
              <span className="op-briefing-beat-title">{beat.title}</span>
              <span className="op-briefing-beat-detail">{beat.detail}</span>
              <span className="op-briefing-beat-report">⚔ {beat.report}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
