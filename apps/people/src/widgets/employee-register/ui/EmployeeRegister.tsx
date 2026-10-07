import type { Employee } from '@baseline/people-contract';
import { formatHourlyRate } from '@baseline/people-domain';
import { InlineMessage, Table, TableCell, TableHeaderCell } from '@baseline/ui';
import { memo } from 'react';
import { Link } from 'react-router';
import { CapacityBadge } from '../../../entities/capacity';
import { EmployeeSearch, useSearchTerm } from '../../../features/search-employees';
import { useHost } from '../../../shared/lib';
import { useRegisterRows } from '../model/useRegisterRows';
import styles from './EmployeeRegister.module.css';

const NO_RATE = 'No rate yet';

/** A row with primitive props and a stable employee, so typing in the search re-renders only the rows that change. */
const EmployeeRow = memo(function EmployeeRow({
  employee,
  rate,
  capacity,
  over,
}: {
  employee: Employee;
  rate: string;
  capacity: string;
  over: boolean;
}) {
  return (
    <tr>
      <TableHeaderCell scope="row">
        <Link to={`/${employee.id}`}>{employee.name}</Link>
      </TableHeaderCell>
      <TableCell>{employee.role}</TableCell>
      <TableCell numeric>{employee.weeklyHours} h</TableCell>
      <TableCell numeric>{rate}</TableCell>
      <TableCell>
        {over ? (
          <CapacityBadge tone="over">{capacity}</CapacityBadge>
        ) : (
          <span className={styles.plain}>{capacity}</span>
        )}
      </TableCell>
    </tr>
  );
});

/**
 * The searchable register (screens 2.1): all employees by name, filtered by name or role as you type (the
 * term lives in `?q=`, D31), with how many match, and each employee's rate today in the display currency.
 */
export function EmployeeRegister() {
  const { currency } = useHost();
  const [term, setTerm] = useSearchTerm();
  const { rows, total, capacity } = useRegisterRows(term);
  const needle = term.trim();
  return (
    <div className={styles.register}>
      {capacity.status === 'unknown' ? (
        <InlineMessage tone="info">
          <strong>Capacity unknown:</strong> Delivery&apos;s data can&apos;t be reached. Employees and rates are
          unaffected.
        </InlineMessage>
      ) : null}
      <div className={styles.toolbar}>
        <EmployeeSearch term={term} onChange={setTerm} />
        <p className={styles.count} aria-live="polite">
          {rows.length} of {total}
        </p>
      </div>
      <Table aria-label="Employees">
        <thead>
          <tr>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell numeric>Weekly hours</TableHeaderCell>
            <TableHeaderCell numeric>Rate today</TableHeaderCell>
            <TableHeaderCell>Capacity</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <TableCell colSpan={5} className={styles.empty}>
                {needle === '' ? 'There are no employees.' : `No employees match "${needle}".`}
              </TableCell>
            </tr>
          ) : (
            rows.map(({ employee, rateTodayEur, capacity: cell }) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                rate={rateTodayEur === null ? NO_RATE : formatHourlyRate(rateTodayEur, currency)}
                capacity={cell.text}
                over={cell.over}
              />
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
