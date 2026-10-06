import { Outlet } from 'react-router';
import { ReactReadout } from '../debug/ReactReadout';
import { Nav } from './Nav';
import styles from './Layout.module.css';

// The outlet never changes, so it is created once.
const outlet = <Outlet />;

/** The frame: navigation on top, the active remote's panel in the middle, the singleton readout below. */
export function Layout() {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Baseline</h1>
        <Nav />
      </header>
      <main>{outlet}</main>
      <ReactReadout />
    </div>
  );
}
