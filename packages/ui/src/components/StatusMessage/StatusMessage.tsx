import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { hasContent } from '../Field/Field';
import styles from './StatusMessage.module.css';

/**
 * The result of the last action ("Saved 0.50 PM for …", D33), kept until the next one replaces it.
 * The `role="status"` element is always rendered, even with nothing to say: assistive technology only
 * announces changes to a live region that was already on the page.
 */
export const StatusMessage = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(function StatusMessage(
  { className, children, ...rest },
  ref,
) {
  return (
    <p {...rest} ref={ref} role="status" aria-atomic="true" className={clsx(styles.status, className)}>
      {hasContent(children) ? (
        <>
          <span className={styles.mark} aria-hidden="true">
            ✓
          </span>
          <span>{children}</span>
        </>
      ) : null}
    </p>
  );
});
