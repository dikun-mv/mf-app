import type { Employee } from '@baseline/people-contract';
import { formatDate, formatHourlyRate, rateOn } from '@baseline/people-domain';
import { Table, TableCell, TableHeaderCell } from '@baseline/ui';
import { useMemo } from 'react';
import { useRateHistory } from '../../../entities/rate-record';
import { useHost, today } from '../../../shared/lib';
import styles from './RateHistory.module.css';

/**
 * An employee's rate history, newest first, with the rate in effect today marked *current* (screens 2.3).
 * A rate runs until the next one starts, so a rate that starts in the future is listed but not current.
 */
export function RateHistory({ employee }: { employee: Employee }) {
  const { currency } = useHost();
  const history = useRateHistory(employee.id);
  const current = rateOn(history, today());
  const newestFirst = useMemo(() => history.toReversed(), [history]);
  return (
    <section className={styles.section} aria-labelledby="rate-history-title">
      <h2 id="rate-history-title" className={styles.title}>
        Rate history
      </h2>
      <Table aria-labelledby="rate-history-title">
        <thead>
          <tr>
            <TableHeaderCell>Valid from</TableHeaderCell>
            <TableHeaderCell>Hourly cost</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {newestFirst.length === 0 ? (
            <tr>
              <TableCell colSpan={2} className={styles.empty}>
                No rates yet.
              </TableCell>
            </tr>
          ) : (
            newestFirst.map((rate) => (
              <tr key={rate.id}>
                <TableCell>{formatDate(rate.validFrom)}</TableCell>
                <TableCell>
                  {formatHourlyRate(rate.hourlyCost, currency)}
                  {rate.id === current?.id ? <span className={styles.current}>current</span> : null}
                </TableCell>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </section>
  );
}
