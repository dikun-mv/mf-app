import { Button, ErrorBoundary, InlineMessage, Spinner } from '@baseline/ui';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { describeError } from '../api';
import styles from './PageBoundary.module.css';

export interface PageBoundaryProps {
  /** What the page loads, capitalised: "Projects". The loading and failure texts are built from it. */
  subject: string;
  /** Shown above the loading and failure states, where the loaded page would show its own header. */
  above?: ReactNode;
  children: ReactNode;
}

/**
 * A page's loading and failure states (D32, screens 4): its own `Suspense` while its data loads, and an
 * error boundary whose "Try again" refetches what failed. The shell's panel spinner only covers loading the
 * remote's code, so an app that has already loaded never falls back to it.
 */
export function PageBoundary({ subject, above, children }: PageBoundaryProps) {
  const lower = subject.toLowerCase();
  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQueries }) => (
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <>
              {above}
              <InlineMessage tone="error" className={styles.failed}>
                <span>
                  {subject} couldn't be loaded: {describeError(error)}.
                </span>
                <Button
                  onClick={() => {
                    resetQueries();
                    reset();
                  }}
                >
                  Try again
                </Button>
              </InlineMessage>
            </>
          )}
        >
          <Suspense
            fallback={
              <>
                {above}
                <p className={styles.loading}>
                  <Spinner aria-label={`Loading ${lower}`} />
                  <span>Loading {lower}…</span>
                </p>
              </>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
