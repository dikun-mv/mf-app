import type { RateRecord } from '@baseline/people-contract';
import { formatDate } from '@baseline/people-domain';
import { Button, TableCell } from '@baseline/ui';
import { memo } from 'react';
import styles from './RateHistory.module.css';

interface RateRowProps {
  rate: RateRecord;
  /** The rate in the display currency: `€95.00/h`. */
  cost: string;
  current: boolean;
  /** Stable setters of the widget, so a row re-renders only when its own rate, its text or its mark changes. */
  onCorrect: (rate: RateRecord) => void;
  onRemove: (rate: RateRecord) => void;
}

/** One rate of the history (screens 2.3): when it starts, what it costs, whether it is in effect, and its actions. */
export const RateRow = memo(function RateRow({ rate, cost, current, onCorrect, onRemove }: RateRowProps) {
  const validFrom = formatDate(rate.validFrom);
  return (
    <tr>
      <TableCell>{validFrom}</TableCell>
      <TableCell>
        {cost}
        {current ? <span className={styles.current}>current</span> : null}
      </TableCell>
      <TableCell>
        <div className={styles.actions}>
          <Button
            aria-label={`Correct the rate from ${validFrom}`}
            onClick={() => {
              onCorrect(rate);
            }}
          >
            Correct
          </Button>
          <Button
            aria-label={`Remove the rate from ${validFrom}`}
            onClick={() => {
              onRemove(rate);
            }}
          >
            Remove
          </Button>
        </div>
      </TableCell>
    </tr>
  );
});
