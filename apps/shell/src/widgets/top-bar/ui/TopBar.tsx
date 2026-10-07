import { Nav } from './Nav';
import styles from './TopBar.module.css';

/** The shell's top bar (screens 1.1): the product name and the two apps to move between. */
export function TopBar() {
  return (
    <header className={styles.bar}>
      <span className={styles.brand}>Baseline</span>
      <Nav />
    </header>
  );
}
