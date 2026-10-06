import { clsx } from 'clsx';
import type { MouseEvent } from 'react';
import { useLocation } from 'react-router';
import { useShellNavigate } from '../routing/navigation';
import styles from './Nav.module.css';

const ITEMS = [
  { to: '/people', label: 'People' },
  { to: '/delivery', label: 'Delivery' },
] as const;

/** Top-level navigation. The active item follows the first path segment, also on back and forward. */
export function Nav() {
  const { pathname } = useLocation();
  const navigate = useShellNavigate();
  const firstSegment = `/${pathname.split('/')[1] ?? ''}`;

  const follow = (event: MouseEvent<HTMLAnchorElement>, to: string): void => {
    // Let the browser handle new-tab and modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <nav className={styles.nav} aria-label="Main">
      {ITEMS.map((item) => (
        <a
          key={item.to}
          href={item.to}
          aria-current={firstSegment === item.to ? 'page' : undefined}
          className={clsx(styles.link, { [styles.active]: firstSegment === item.to })}
          onClick={(event) => {
            follow(event, item.to);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
