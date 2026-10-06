import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import styles from './Spinner.module.css';

/** A busy indicator. The label is what assistive technology reads. */
export const Spinner = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(function Spinner(
  { className, 'aria-label': label = 'Loading', ...rest },
  ref,
) {
  return <span {...rest} ref={ref} role="status" aria-label={label} className={clsx(styles.spinner, className)} />;
});
