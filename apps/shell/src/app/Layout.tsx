import { Outlet } from 'react-router';
import { StatusStrip } from '../widgets/status-strip';
import { TopBar } from '../widgets/top-bar';
import styles from './Layout.module.css';

// The outlet never changes, so it is created once.
const outlet = <Outlet />;

/** The frame (screens 1.1): the top bar, the active remote's panel in the middle, the status strip below. */
export function Layout() {
  return (
    <div className={styles.layout}>
      <TopBar />
      <main className={styles.main}>{outlet}</main>
      <StatusStrip />
    </div>
  );
}
