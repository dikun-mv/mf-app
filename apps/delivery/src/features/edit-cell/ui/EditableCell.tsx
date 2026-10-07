import type { DisplayUnit } from '@baseline/delivery-domain';
import { useEffect, useRef, useState } from 'react';
import type { EditableCellProps } from './cellProps';
import { CellEditor } from './CellEditor';
import styles from './EditableCell.module.css';
import { UNIT_NAMES } from './unitNames';

/**
 * A person's cell, editable (T6.6, D36): its value in a `<button>` whose accessible name carries the row,
 * month and unit. Enter or a click turns it into an input (`CellEditor`); Enter or Esc puts the button back
 * and returns focus to it, while blur leaves focus where the user moved it. The markers (`adornment`) sit
 * beside the value, inside the button, so the button's `aria-describedby` points at the details panel
 * where the markers' full text is (T6.9, T6.12).
 *
 * The editor remembers the unit it was opened in, and a unit change closes it for good instead of leaving a
 * draft typed in one unit under numbers shown in another.
 */
export function EditableCell(props: EditableCellProps) {
  const { row, cell, month, unit, adornment, describedById } = props;
  const [editingIn, setEditingIn] = useState<DisplayUnit | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  // A unit change ends the edit for good: the draft was typed in the old unit, and the editor must not come
  // back, taking focus, when the user returns to it. (Adjusting state while rendering, not in an effect.)
  if (editingIn !== null && editingIn !== unit) setEditingIn(null);
  const editing = editingIn === unit;
  const hasAdornment = adornment !== null;

  // The button is back after an editor closed by key: give it the focus the input had.
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <span className={styles.cell}>
        <CellEditor
          row={row}
          cell={cell}
          month={month}
          unit={unit}
          describedById={describedById}
          hasAdornment={hasAdornment}
          onClose={(focusButton) => {
            returnFocus.current = focusButton;
            setEditingIn(null);
          }}
        />
        {adornment}
      </span>
    );
  }
  const stored = cell.allocationId !== null;
  return (
    <button
      ref={button}
      type="button"
      className={styles.value}
      aria-label={`${row.label}, ${month.name}, ${UNIT_NAMES[unit]}: ${stored ? cell.text : 'no allocation'}`}
      aria-describedby={hasAdornment ? describedById : undefined}
      onClick={() => {
        setEditingIn(unit);
      }}
    >
      {stored ? (
        cell.text
      ) : (
        <span aria-hidden="true" className={styles.empty}>
          &middot;
        </span>
      )}
      {adornment}
    </button>
  );
}
