import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import styles from './InlineMessage.module.css';

export type InlineMessageTone = 'info' | 'warning' | 'error';

const byTone = {
  info: styles.info,
  warning: styles.warning,
  error: styles.error,
} satisfies Record<InlineMessageTone, string>;

export interface InlineMessageProps extends ComponentPropsWithoutRef<'div'> {
  tone?: InlineMessageTone;
}

/** A message shown where the content it is about would be. Errors are announced (`role="alert"`). */
export const InlineMessage = forwardRef<HTMLDivElement, InlineMessageProps>(function InlineMessage(
  { tone = 'info', className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx(styles.message, byTone[tone], className)}
    />
  );
});
