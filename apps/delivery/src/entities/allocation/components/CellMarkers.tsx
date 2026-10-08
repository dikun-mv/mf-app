import type { MarkerKind, PersonCellView } from '@baseline/delivery-domain';
import { clsx } from 'clsx';
import styles from './CellMarkers.module.css';

/** What a screen reader hears for each glyph, in place of the glyph itself. */
const MARKER_NAMES: Record<MarkerKind, string> = {
  overCapacity: 'Over capacity',
  partiallyPriced: 'Partly priced',
  unpriced: 'Unpriced',
};

/**
 * The markers of a person cell (T6.9, screens 3.3): `†` over capacity, `◐` partly priced, `○` unpriced.
 * Their words come from `gridView` (D35), so this only places them: the glyph is drawn, its full text is
 * the `title`, and the cell's own `aria-describedby` reaches the same text in the details panel (D36).
 * Nothing renders for a cell without markers.
 *
 * The glyphs hang in the cell's right padding rather than push the number left, so the figures of a
 * column keep lining up whether or not a cell is marked.
 */
export function CellMarkers({ cell }: { cell: Pick<PersonCellView, 'markers'> }) {
  if (cell.markers.length === 0) return null;
  return (
    <span className={styles.markers}>
      {cell.markers.map((marker) => (
        <span key={marker.kind} className={clsx(styles.marker, styles[marker.kind])} title={marker.text}>
          <span aria-hidden="true">{marker.symbol}</span>
          <span className={styles.visuallyHidden}>{MARKER_NAMES[marker.kind]}</span>
        </span>
      ))}
    </span>
  );
}
