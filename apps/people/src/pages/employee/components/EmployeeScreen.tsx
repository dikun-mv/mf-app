import { EmployeeId } from '@baseline/people-contract';
import { InlineMessage } from '@baseline/ui';
import { useParams } from 'react-router';
import { useEmployee } from '../../../entities/employee';
import { BackToRegister, PageBoundary } from '../../../shared/components';
import { EmployeeProfile } from '../../../widgets/employee-profile';
import { RateHistory } from '../../../widgets/rate-history';
import styles from './EmployeeScreen.module.css';

/** Screens 2.7: the way back, and a message that names what was asked for. */
function EmployeeNotFound({ id }: { id: string }) {
  return (
    <div className={styles.notFound}>
      <BackToRegister />
      <InlineMessage tone="warning">Employee not found: there is no employee &quot;{id}&quot;.</InlineMessage>
    </div>
  );
}

/** A known employee: the profile, then the rate history. Unknown ids are the page's "not found". */
function EmployeeDetail({ id }: { id: EmployeeId }) {
  const employee = useEmployee(id);
  if (employee === undefined) return <EmployeeNotFound id={id} />;
  return (
    <div>
      <EmployeeProfile employee={employee} />
      <RateHistory employee={employee} />
    </div>
  );
}

/**
 * An employee's page at `<basePath>/:employeeId` (screens 2.3, 2.7). The id in the URL is parsed into a branded
 * `EmployeeId`; a malformed one is as unknown as an id nobody has. The data loads under the page's own loading
 * and load-failed states (D32). Reloading the URL reopens the same employee.
 */
export function EmployeeScreen() {
  const id = useParams().employeeId ?? '';
  const parsed = EmployeeId.safeParse(id);
  return parsed.success ? (
    // Keyed by the employee: going from one employee's URL straight to another's reuses this element, and the
    // open forms, the status line and a failure message belong to the first employee.
    <PageBoundary key={parsed.data} subject="employee">
      <EmployeeDetail id={parsed.data} />
    </PageBoundary>
  ) : (
    <EmployeeNotFound id={id} />
  );
}
