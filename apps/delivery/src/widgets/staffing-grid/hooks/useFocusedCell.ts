import { useCallback, useState, type FocusEvent } from 'react';

/** A person's cell, by its row's key and the position of its month. */
export interface FocusedCell {
  readonly rowKey: string;
  readonly monthIndex: number;
}

/**
 * Which person cell has focus, for the details panel that follows it (T6.12). It reads the `data-row-key`
 * and `data-month-index` of the `<td>` that holds the focused element, so whatever a cell renders (a
 * button, an input) is tracked without knowing about it. Focus leaving the grid doesn't clear it: the
 * panel keeps showing the last cell. Pass `onFocus` to the element around the table.
 */
export function useFocusedCell() {
  const [focus, setFocus] = useState<FocusedCell | null>(null);
  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;
    const { rowKey, monthIndex } = event.target.closest<HTMLElement>('[data-row-key]')?.dataset ?? {};
    const position = Number(monthIndex);
    if (rowKey === undefined || !Number.isInteger(position)) return;
    setFocus((current) =>
      current?.rowKey === rowKey && current.monthIndex === position ? current : { rowKey, monthIndex: position },
    );
  }, []);
  return { focus, onFocus };
}
