import { rowActions, type RowActionId } from '@baseline/delivery-domain';
import { useId, useState } from 'react';
import { usePlanState } from '../model/usePlanState';
import { ChosenAction } from './ChosenAction';
import styles from './RowActions.module.css';
import type { RowActionsSlotProps } from './slots/types';

/**
 * The actions of one WBS row (D36, screens 3.4): a `⋯` button, and under the name, while it is open, a
 * plain button per action from `rowActions`. An action that can't apply is disabled with its reason as
 * text beside it, never hidden. Choosing one closes the list and opens that action's dialog or field,
 * which this row keeps until it is done, so the dialog outlives the list.
 *
 * The data is read only while the list or an action is showing: a closed row costs a button.
 */
export function RowActions({ row, open, onToggle }: RowActionsSlotProps) {
  const [chosen, setChosen] = useState<RowActionId | null>(null);
  const listId = useId();
  const { itemId } = row;
  if (itemId === null) return null;
  return (
    <>
      <button
        type="button"
        className={styles.more}
        aria-label={`Actions for ${row.label}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ActionList
          id={listId}
          itemId={itemId}
          onChoose={(action) => {
            setChosen(action);
            onToggle();
          }}
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

/** The list itself, in `rowActions`' order, so what it offers and what the operations then do can't disagree. */
function ActionList({
  id,
  itemId,
  onChoose,
}: {
  id: string;
  itemId: NonNullable<RowActionsSlotProps['row']['itemId']>;
  onChoose: (action: RowActionId) => void;
}) {
  const state = usePlanState();
  const actions = rowActions(state, itemId);
  // The item has gone while its list was open (another user deleted it): the row goes with it.
  if (!actions.ok) return null;
  return (
    <ul id={id} className={styles.list}>
      {actions.value.map((action) => (
        <li key={action.id} className={styles.entry}>
          <button
            type="button"
            className={styles.action}
            disabled={!action.allowed}
            onClick={() => {
              onChoose(action.id);
            }}
          >
            {action.label}
          </button>
          {!action.allowed && <span className={styles.reason}>{action.reason}</span>}
        </li>
      ))}
    </ul>
  );
}
