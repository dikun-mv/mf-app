import type { PersonCellView } from '@baseline/delivery-domain';
import styles from './StaffingGrid.module.css';

/**
 * A person's cell as plain text: the displayed value, or `·` where nothing is stored for the month, which
 * a screen reader hears as the value with "no allocation" (screens 3.2). The editor replaces this (T6.6).
 */
export function DefaultCell({ cell }: { cell: PersonCellView }) {
  if (cell.allocationId !== null) return <>{cell.text}</>;
  return (
    <>
      <span aria-hidden="true" className={styles.empty}>
        &middot;
      </span>
      <span className={styles.visuallyHidden}>{cell.text}, no allocation</span>
    </>
  );
}
