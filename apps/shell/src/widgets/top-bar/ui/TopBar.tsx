import { CurrencySelect } from '../../../features/switch-currency';
import { UserSelect } from '../../../features/pick-user';
import { Nav } from './Nav';
import styles from './TopBar.module.css';

/** The shell's top bar (screens 1.1): the product name, the two apps, and the currency and user switchers. */
export function TopBar() {
  return (
    <header className={styles.bar}>
      <span className={styles.brand}>Baseline</span>
      <Nav />
      <div className={styles.switchers}>
        <CurrencySelect />
        <UserSelect />
      </div>
    </header>
  );
}
