import type { CellDetails, GridView, PersonCellView } from '@baseline/delivery-domain';
import { clsx } from 'clsx';
import styles from './CellDetailsPanel.module.css';

export interface CellDetailsPanelProps {
  /** The panel's id: the cells' `aria-describedby` points at it (D36). */
  id: string;
  view: GridView;
  /** The cell that last had focus, by its row's key and the position of its month; null before any has. */
  focus: { readonly rowKey: string; readonly monthIndex: number } | null;
}

/** The person cell `focus` names, or null when there is none (nothing focused yet, or the row has gone). */
function focusedCell(view: GridView, focus: CellDetailsPanelProps['focus']): PersonCellView | null {
  if (focus === null) return null;
  const row = view.rows.find((candidate) => candidate.key === focus.rowKey);
  return row?.kind === 'person' ? (row.cells[focus.monthIndex] ?? null) : null;
}

/**
 * The cell details panel under the grid (T6.12, screens 3.2 and 3.3). It follows the focused person cell
 * and spells out what the grid shows in one unit: the value in all four, the person-month, the working
 * days per rate, the blended rate, and the full text of the cell's markers. Every word comes from
 * `gridView` (D35); this only places it. Without People's data the cell has no hours or rates, and those
 * lines are left out.
 *
 * The panel is always in the page, with its id, so a cell's `aria-describedby` always resolves. Derived
 * rows aren't focusable (D36), so they never get details.
 */
export function CellDetailsPanel({ id, view, focus }: CellDetailsPanelProps) {
  const details = focusedCell(view, focus)?.details ?? null;
  return (
    <section id={id} className={styles.panel} aria-labelledby={`${id}-title`}>
      {details === null ? (
        <>
          <h2 id={`${id}-title`} className={styles.title}>
            Cell details
          </h2>
          <p className={styles.hint}>Focus a person’s cell to see how its value is worked out.</p>
        </>
      ) : (
        <Details id={id} details={details} />
      )}
    </section>
  );
}

function Details({ id, details }: { id: string; details: CellDetails }) {
  const { conversion, personMonth, pricing, markers } = details;
  return (
    <>
      <h2 id={`${id}-title`} className={styles.title}>
        {details.title}
      </h2>
      <p className={styles.conversion}>{conversion}</p>
      {(personMonth !== null || pricing !== null) && (
        <div className={styles.workings}>
          {personMonth !== null && <p>{personMonth.text}</p>}
          {pricing !== null && (
            <>
              <p>{pricing.slicesText}</p>
              <p>{pricing.blendedRateText}</p>
            </>
          )}
        </div>
      )}
      {markers.length > 0 && (
        <ul className={styles.markers}>
          {markers.map((marker) => (
            <li key={marker.kind} className={styles.note}>
              <span aria-hidden="true" className={clsx(styles.glyph, styles[marker.kind])}>
                {marker.symbol}
              </span>
              <span>{marker.text}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
