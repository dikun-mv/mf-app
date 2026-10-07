import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Faulty({ broken }: { broken: { current: boolean } }) {
  if (broken.current) throw new Error('boom');
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  // React logs every caught render error; keep the test output readable.
  beforeEach(() => {
    rs.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    rs.restoreAllMocks();
  });

  it('renders its children while nothing fails', () => {
    render(
      <ErrorBoundary fallback={() => <p>Failed</p>}>
        <p>Child</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('shows the fallback with the error and reports it through onError', () => {
    const onError = rs.fn();
    const broken = { current: true };
    render(
      <ErrorBoundary
        onError={onError}
        fallback={({ error }) => <p role="alert">{error instanceof Error ? error.message : 'unknown'}</p>}
      >
        <Faulty broken={broken} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('renders the children again after reset', async () => {
    const broken = { current: true };
    render(
      <ErrorBoundary
        fallback={({ reset }) => (
          <button
            onClick={() => {
              broken.current = false;
              reset();
            }}
          >
            Try again
          </button>
        )}
      >
        <Faulty broken={broken} />
      </ErrorBoundary>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
