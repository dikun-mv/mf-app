import { Button, ErrorBoundary, InlineMessage, Spinner } from '@baseline/ui';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { describeError } from '../api';
import styles from './PageBoundary.module.css';

/** `employees` becomes `Employees`: the failure message starts a sentence with it. */
const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The loading and load-failed states every data page has (D32, screens 4). The page's own data suspends
 * below it, so the page shows "Loading <subject>…" and, if the load fails, an inline message with a retry
 * that refetches (`QueryErrorResetBoundary`). The shell's panel spinner only ever covers loading the
 * remote's code. `subject` is lower case: `employees`.
 */
export function PageBoundary({ subject, children }: { subject: string; children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          fallback={({ error, reset: clear }) => (
            <InlineMessage tone="error" className={styles.failed}>
              <span>
                {capitalised(subject)} couldn&apos;t be loaded: {describeError(error)}.
              </span>
              <Button
                onClick={() => {
                  reset();
                  clear();
                }}
              >
                Try again
              </Button>
            </InlineMessage>
          )}
        >
          <Suspense
            fallback={
              <p className={styles.loading}>
                <Spinner aria-hidden="true" role="presentation" />
                <span role="status">Loading {subject}…</span>
              </p>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
