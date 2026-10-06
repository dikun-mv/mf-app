import { Button } from '@baseline/ui';
import { useState, version } from 'react';
import { Link } from 'react-router';
import { useHost } from '../host/HostContextProvider';
import styles from './Screen.module.css';

/** Placeholder for the employee register (index route). Real features arrive in Phase 5. */
export function RegisterScreen() {
  const { activeUser, currency } = useHost();
  const [clicks, setClicks] = useState(0);
  return (
    <section className={styles.screen}>
      <h2>People: register (placeholder)</h2>
      <p>
        Acting as {activeUser.name}, showing {currency.code}. React {version}.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          setClicks((n) => n + 1);
        }}
      >
        Clicked {clicks} times
      </Button>
      <ul className={styles.links}>
        <li>
          <Link to="emp-003">Open emp-003</Link>
        </li>
        <li>
          <Link to="not-an-id">Open an invalid id</Link>
        </li>
      </ul>
    </section>
  );
}
