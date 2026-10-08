import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './CapacityBadge.module.css';

/**
 * People's one badge: a short label that an employee is over capacity, or within it. The words carry the
 * meaning; the colour only helps the eye find them.
 */
export function CapacityBadge({ tone, children }: { tone: 'over' | 'within'; children: ReactNode }) {
  return <span className={clsx(styles.badge, tone === 'over' ? styles.over : styles.within)}>{children}</span>;
}
