import { InlineMessage } from '@baseline/ui';
import { Link } from 'react-router';
import styles from './NotFound.module.css';

/** Screens 1.3: the shell's own message for a first path segment it doesn't know. No remote is loaded. */
export function NotFound() {
  return (
    <div className={styles.page}>
      <InlineMessage tone="warning">
        <strong>Not found.</strong> <Link to="/people">Go to People</Link>
      </InlineMessage>
    </div>
  );
}
