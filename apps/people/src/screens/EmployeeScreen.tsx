import { EmployeeId } from '@baseline/people-contract';
import { Button } from '@baseline/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { NotFoundScreen } from './NotFoundScreen';
import styles from './Screen.module.css';

/** Placeholder for one employee. The id from the URL is parsed into a branded `EmployeeId`. */
export function EmployeeScreen() {
  const parsed = EmployeeId.safeParse(useParams().employeeId);
  const [notes, setNotes] = useState(0);
  if (!parsed.success) return <NotFoundScreen message="That is not a valid employee id." />;
  return (
    <section className={styles.screen}>
      <h2>Employee {parsed.data} (placeholder)</h2>
      <Button
        onClick={() => {
          setNotes((n) => n + 1);
        }}
      >
        Notes added: {notes}
      </Button>
      <p>
        <Link to="/">Back to the register</Link>
      </p>
    </section>
  );
}
