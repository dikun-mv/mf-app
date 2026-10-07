import styles from './StaffingGrid.module.css';
import type { CellSlotProps } from './slots/types';

/**
 * A person's cell as plain text: the displayed value, or `·` where nothing is stored for the month, which
 * a screen reader hears as the value with "no allocation" (screens 3.2). The grid's cell slot holds the editor instead (T6.6, `features/edit-cell`); this is the read-only version.
 *
 * It is also the model for a renderer: the `adornment` (the markers) goes right after the value, and
 * `describedById` goes on the element that takes focus. This text isn't focusable, so the id sits on the
 * wrapper only while there is an adornment to describe; an editor puts it on its button or input.
 */
export function DefaultCell({ cell, adornment, describedById }: CellSlotProps) {
  const value =
    cell.allocationId !== null ? (
      cell.text
    ) : (
      <>
        <span aria-hidden="true" className={styles.empty}>
          &middot;
        </span>
        <span className={styles.visuallyHidden}>{cell.text}, no allocation</span>
      </>
    );
  if (adornment === null) return <>{value}</>;
  return (
    <span aria-describedby={describedById}>
      {value}
      {adornment}
    </span>
  );
}
