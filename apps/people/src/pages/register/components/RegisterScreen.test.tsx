import { Currency } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, testContext } from '../../../shared/testing';
import { RegisterScreen } from './RegisterScreen';

/** The names in the table body, in order. */
const listedNames = () =>
  within(screen.getByRole('table', { name: 'Employees' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('rowheader')[0]?.textContent);

const search = () => screen.getByRole('searchbox', { name: 'Search name or role' });

async function renderRegister(options: Parameters<typeof renderWithApp>[1] = {}) {
  const app = renderWithApp(<RegisterScreen />, options);
  await screen.findByRole('table', { name: 'Employees' });
  return app;
}

describe('the register', () => {
  it('lists every employee by name with role, weekly hours and the rate today', async () => {
    await renderRegister();
    expect(listedNames()).toEqual([
      'Adaeze Okafor',
      'Lena Okafor',
      'Milan Brandt',
      'Priya Raman',
      'Samira Haddad',
      'Tomas Novak',
    ]);
    const row = within(screen.getByRole('row', { name: /Samira Haddad/ }));
    expect(row.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(row.getByText('32 h')).toBeInTheDocument();
    expect(row.getByText('€106.00/h')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rate today' })).toBeInTheDocument();
  });

  it('shows the rate in effect today, not one that starts in the future, and says when there is none', async () => {
    await renderRegister();
    // Adaeze has €80 from 2025, €95 from 12 Mar 2026 and a €120 rate that starts in 2099.
    expect(within(screen.getByRole('row', { name: /Adaeze Okafor/ })).getByText('€95.00/h')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Tomas Novak/ })).getByText('No rate yet')).toBeInTheDocument();
  });

  it('shows the rate in the display currency', async () => {
    await renderRegister({ ctx: testContext({ currency: Currency.parse({ code: 'USD', perEur: 1.08 }) }) });
    expect(within(screen.getByRole('row', { name: /Adaeze Okafor/ })).getByText('$102.60/h')).toBeInTheDocument();
  });

  it('links each name to the employee page', async () => {
    await renderRegister();
    expect(screen.getByRole('link', { name: 'Milan Brandt' })).toHaveAttribute('href', '/emp-003');
  });
});

describe('searching the register', () => {
  it('shows the count of everyone before a search', async () => {
    await renderRegister();
    expect(screen.getByText('6 of 6')).toBeInTheDocument();
  });

  it('filters by name as you type, ignoring case, and counts the matches', async () => {
    const user = userEvent.setup();
    await renderRegister();
    await user.type(search(), 'OKAFOR');
    expect(listedNames()).toEqual(['Adaeze Okafor', 'Lena Okafor']);
    expect(screen.getByText('2 of 6')).toBeInTheDocument();
  });

  it('filters by role', async () => {
    const user = userEvent.setup();
    await renderRegister();
    await user.type(search(), 'tech lead');
    expect(listedNames()).toEqual(['Adaeze Okafor', 'Priya Raman']);
    expect(screen.getByText('2 of 6')).toBeInTheDocument();
  });

  it('keeps the term in ?q= and removes it when cleared', async () => {
    const user = userEvent.setup();
    const { router } = await renderRegister();
    await user.type(search(), 'okafor');
    expect(router.state.location.search).toBe('?q=okafor');
    await user.clear(search());
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('6 of 6')).toBeInTheDocument();
  });

  it('opens with the search from the URL, so a reload keeps it', async () => {
    await renderRegister({ route: '/?q=okafor' });
    expect(search()).toHaveValue('okafor');
    expect(listedNames()).toEqual(['Adaeze Okafor', 'Lena Okafor']);
    expect(screen.getByText('2 of 6')).toBeInTheDocument();
  });

  it('says so when nothing matches, in place of the rows', async () => {
    const user = userEvent.setup();
    await renderRegister();
    await user.type(search(), 'xyz');
    expect(screen.getByText('No employees match "xyz".')).toBeInTheDocument();
    expect(screen.getByText('0 of 6')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('the register while loading and when loading fails', () => {
  it('shows the title and a loading message until the employees arrive', async () => {
    const repository = createFakeRepository();
    const release = repository.holdReads();
    renderWithApp(<RegisterScreen />, { repository });

    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(await screen.findByText('Loading employees…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    release();
    expect(await screen.findByRole('table', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.queryByText('Loading employees…')).not.toBeInTheDocument();
  });

  it('says what went wrong and loads again on "Try again"', async () => {
    const user = userEvent.setup();
    const repository = createFakeRepository();
    repository.failReads(new ApiError('unavailable', 'people'));
    renderWithApp(<RegisterScreen />, { repository });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Employees couldn't be loaded: the People service didn't respond.",
    );
    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument();

    repository.failReads(null);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
