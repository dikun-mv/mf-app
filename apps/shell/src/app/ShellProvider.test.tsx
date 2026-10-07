import type { RemoteAppProps } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { SELECTION_KEY } from '../shared/config';
import { fakeLoader, memoryStorage } from '../shared/testing';
import { renderShell } from './testing/renderShell';

/** A remote that counts how often it mounts and shows what the shell pushed into it. */
function countingApp() {
  const mounts = { count: 0 };
  function Counting({ ctx }: RemoteAppProps) {
    useEffect(() => {
      mounts.count += 1;
    }, []);
    return (
      <p>
        {ctx.currency.code} at {ctx.currency.perEur} for {ctx.activeUser.name}
      </p>
    );
  }
  return { Counting, mounts };
}

describe('the currency and user switchers', () => {
  it('start from the config default and the first user', async () => {
    const { Counting } = countingApp();
    renderShell('/people', { loader: fakeLoader(Counting) });

    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('EUR');
    expect(screen.getByRole('combobox', { name: 'User' })).toHaveDisplayValue('Demo Planner');
    expect(await screen.findByText('EUR at 1 for Demo Planner')).toBeInTheDocument();
  });

  it('push a new currency into the mounted panel without remounting it', async () => {
    const user = userEvent.setup();
    const { Counting, mounts } = countingApp();
    renderShell('/people', { loader: fakeLoader(Counting) });
    await screen.findByText('EUR at 1 for Demo Planner');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'USD');

    expect(screen.getByText('USD at 1.08 for Demo Planner')).toBeInTheDocument();
    expect(mounts.count).toBe(1);
  });

  it('push a new user the same way', async () => {
    const user = userEvent.setup();
    const { Counting, mounts } = countingApp();
    renderShell('/delivery', { loader: fakeLoader(Counting) });
    await screen.findByText('EUR at 1 for Demo Planner');

    await user.selectOptions(screen.getByRole('combobox', { name: 'User' }), 'Demo Lead');

    expect(screen.getByText('EUR at 1 for Demo Lead')).toBeInTheDocument();
    expect(mounts.count).toBe(1);
  });

  it('keep both choices in localStorage and restore them on the next load', async () => {
    const user = userEvent.setup();
    const { Counting } = countingApp();
    const storage = memoryStorage();
    const first = renderShell('/people', { loader: fakeLoader(Counting), storage });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'GBP');
    await user.selectOptions(screen.getByRole('combobox', { name: 'User' }), 'Demo Lead');
    expect(JSON.parse(storage.values.get(SELECTION_KEY) ?? 'null')).toEqual({ currency: 'GBP', userId: 'user-2' });
    first.unmount();

    renderShell('/people', { loader: fakeLoader(Counting), storage });
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('GBP');
    expect(screen.getByRole('combobox', { name: 'User' })).toHaveDisplayValue('Demo Lead');
    expect(await screen.findByText('GBP at 0.85 for Demo Lead')).toBeInTheDocument();
  });

  it('keep the choice when the page moves from one app to the other', async () => {
    const user = userEvent.setup();
    const { Counting } = countingApp();
    renderShell('/people', { loader: fakeLoader(Counting) });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'USD');

    await user.click(screen.getByRole('link', { name: 'Delivery' }));

    expect(await screen.findByText('USD at 1.08 for Demo Planner')).toBeInTheDocument();
  });
});
