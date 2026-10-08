import { rowActions, type RowActionId } from '@baseline/delivery-domain';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { usePlanState } from '../hooks/usePlanState';
import { ChosenAction } from './ChosenAction';
import styles from './RowActions.module.css';
import type { RowActionsSlotProps } from './slots/types';

/**
 * The actions of one WBS row (D36, screens 3.4): a `⋯` button, and while it is open a dropdown under it
 * with a plain button per action from `rowActions`. An action that can't apply is disabled, never hidden,
 * and a `?` beside it shows the reason in a tooltip. Choosing one closes the list and opens that action's dialog or field,
 * which this row keeps until it is done, so the dialog outlives the list. Esc or a click outside the list
 * closes it too.
 *
 * The data is read only while the list or an action is showing: a closed row costs a button.
 */
export function RowActions({ row, open, onToggle }: RowActionsSlotProps) {
  const [chosen, setChosen] = useState<RowActionId | null>(null);
  const listId = useId();
  const more = useRef<HTMLButtonElement>(null);
  // The list is drawn in the top layer and placed against the button by CSS anchor positioning.
  const anchor = `--row-actions-${listId.replace(/[^\w-]/g, '')}`;
  const { itemId } = row;
  if (itemId === null) return null;
  return (
    <>
      <button
        ref={more}
        type="button"
        className={styles.more}
        aria-label={`Actions for ${row.label}`}
        aria-expanded={open}
        aria-controls={listId}
        style={{ anchorName: anchor }}
        onClick={onToggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ActionList
          id={listId}
          anchor={anchor}
          more={more}
          itemId={itemId}
          onChoose={(action) => {
            setChosen(action);
            onToggle();
          }}
          onDismiss={onToggle}
        />
      )}
      {chosen !== null && (
        <ChosenAction
          action={chosen}
          itemId={itemId}
          onClose={() => {
            setChosen(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Lifts the list into the top layer as a manual popover, so it shows over the grid and isn't clipped by
 * its scrolling box or covered by the sticky columns. Module-level, so React calls it once per mount. It
 * stays in the label cell in the DOM, so Tab still reaches it straight after `⋯`. Where popovers aren't
 * supported (jsdom) the list stays in flow under the name.
 */
const showOverGrid = (list: HTMLUListElement | null) => {
  if (list === null || typeof list.showPopover !== 'function') return;
  list.setAttribute('popover', 'manual');
  list.showPopover();
};

/** The list itself, in `rowActions`' order, so what it offers and what the operations then do can't disagree. */
function ActionList({
  id,
  anchor,
  more,
  itemId,
  onChoose,
  onDismiss,
}: {
  id: string;
  /** The `⋯` button's `anchor-name`, which the list is positioned against. */
  anchor: string;
  /** The `⋯` button: a press on it is its own toggle, not a click outside. */
  more: RefObject<HTMLButtonElement>;
  itemId: NonNullable<RowActionsSlotProps['row']['itemId']>;
  onChoose: (action: RowActionId) => void;
  /** Esc, or a press anywhere but the list and `⋯`. */
  onDismiss: () => void;
}) {
  useEffect(() => {
    const inList = (node: Node | null) => node !== null && document.getElementById(id)?.contains(node) === true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Focus inside the list would be lost with it, so it goes back to `⋯`.
      if (inList(document.activeElement)) more.current?.focus();
      onDismiss();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (inList(target) || (target !== null && more.current?.contains(target) === true)) return;
      onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [id, more, onDismiss]);

  const state = usePlanState();
  const actions = rowActions(state, itemId);
  // The item has gone while its list was open (another user deleted it): the row goes with it.
  if (!actions.ok) return null;
  return (
    <ul id={id} ref={showOverGrid} className={styles.list} style={{ positionAnchor: anchor }}>
      {actions.value.map((action) => {
        const reasonId = `${id}-${action.id}-reason`;
        return (
          <li key={action.id} className={styles.entry}>
            <button
              type="button"
              className={styles.action}
              disabled={!action.allowed}
              aria-describedby={action.allowed ? undefined : reasonId}
              onClick={() => {
                onChoose(action.id);
              }}
            >
              {action.label}
            </button>
            {!action.allowed && <Reason id={reasonId} action={action.label} reason={action.reason} />}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Why an action is refused: a `?` that shows the reason in a tooltip while it is hovered or focused, or
 * the action's line is hovered. The `?` is a button so the keyboard reaches it (the disabled action
 * can't take focus), and both it and the action name the tooltip in `aria-describedby` (D36).
 */
function Reason({ id, action, reason }: { id: string; action: string; reason: string }) {
  return (
    <span className={styles.why}>
      <button type="button" className={styles.hint} aria-label={`Why ${action} is unavailable`} aria-describedby={id}>
        <span aria-hidden="true">?</span>
      </button>
      <span id={id} role="tooltip" className={styles.tooltip}>
        {reason}
      </span>
    </span>
  );
}
