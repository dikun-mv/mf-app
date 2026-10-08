import { DISPLAY_UNITS, type DisplayUnit } from '@baseline/delivery-domain';
import { clsx } from 'clsx';
import { useUnit } from '../hooks/useUnit';
import styles from './UnitSwitcher.module.css';

/** How each unit reads on its radio (screens 3.2). */
const UNIT_LABELS: Record<DisplayUnit, string> = {
  hours: 'Hours',
  personMonths: 'Person-months',
  percent: '% of capacity',
  cost: 'Cost',
};

export interface UnitSwitcherProps {
  /** The unit the grid shows now. */
  unit: DisplayUnit;
  /** The units that can be shown; the others stay on the list, disabled (screens 3.6). */
  units: readonly DisplayUnit[];
}

/**
 * The grid's unit as a native radio group (T6.5): Hours, Person-months, % of capacity and Cost. Choosing
 * one writes `?unit=` and nothing else, so nothing is saved by switching. A unit that needs data that
 * isn't there stays visible but disabled, and says so in its label. Native radios give the arrow keys,
 * the group name and the focus order for free.
 */
export function UnitSwitcher({ unit, units }: UnitSwitcherProps) {
  const [, setUnit] = useUnit();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Unit</legend>
      {DISPLAY_UNITS.map((candidate) => {
        const available = units.includes(candidate);
        return (
          <label key={candidate} className={clsx(styles.option, !available && styles.unavailable)}>
            <input
              type="radio"
              name="unit"
              value={candidate}
              checked={unit === candidate}
              disabled={!available}
              onChange={() => {
                setUnit(candidate);
              }}
            />
            {UNIT_LABELS[candidate]}
            {!available && ' (unavailable)'}
          </label>
        );
      })}
    </fieldset>
  );
}
