import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeLoader } from '../../shared/testing';
import { renderShell } from '../testing/renderShell';

// A loader that never answers keeps the panel on its spinner: these tests are about which route matches.
const pending = () => ({ loader: fakeLoader() });

describe('the shell routes', () => {
  it('redirects / to /people', () => {
    const { router } = renderShell('/', pending());
    expect(router.state.location.pathname).toBe('/people');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/people', '/people/emp-003', '/delivery', '/delivery/prj-1'])('hosts a remote at %s', (path) => {
    renderShell(path, pending());
    expect(screen.queryByText(/Not found/)).not.toBeInTheDocument();
    expect(screen.getByText(/Loading (People|Delivery)/)).toBeInTheDocument();
  });

  it('shows the not-found message for an unknown first segment, with a way back to People', async () => {
    const user = userEvent.setup();
    const { router } = renderShell('/reports', pending());

    expect(screen.getByText('Not found.')).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('link', { name: 'Go to People' }));
    expect(router.state.location.pathname).toBe('/people');
  });
});
