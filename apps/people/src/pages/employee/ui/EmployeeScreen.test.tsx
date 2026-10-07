import { Currency } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, testContext } from '../../../shared/testing';
import { EmployeeScreen } from './EmployeeScreen';

const routes = [{ path: ':employeeId', element: <EmployeeScreen /> }];

async function renderEmployee(id: string, options: Parameters<typeof renderWithApp>[1] = {}) {
  const app = renderWithApp(routes, { ...options, route: `/${id}` });
  await screen.findByRole('heading', { level: 1 });
  return app;
}

/** The history's rows as text (the day, then the cost and its mark), header row and actions left out. */
const historyRows = () =>
  within(screen.getByRole('table', { name: 'Rate history' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 2)
        .map((cell) => cell.textContent)
        .join(''),
    );

describe('an employee page', () => {
  it('shows the name, then role, weekly hours and id', async () => {
    await renderEmployee('emp-001');
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze Okafor' })).toBeInTheDocument();
    expect(screen.getByText('Tech Lead · 40 h/week · emp-001')).toBeInTheDocument();
  });

  it('has no way to delete the employee (D16)', async () => {
    await renderEmployee('emp-001');
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('lists the rate history newest first and marks the rate in effect today as current', async () => {
    await renderEmployee('emp-001');
    // The fixture has a rate that starts in 2099: listed first, but not current.
    expect(historyRows()).toEqual(['1 Jan 2099€120.00/h', '12 Mar 2026€95.00/hcurrent', '1 Jan 2025€80.00/h']);
    expect(screen.getAllByText('current')).toHaveLength(1);
  });

  it('shows the rates in the display currency', async () => {
    await renderEmployee('emp-001', { ctx: testContext({ currency: Currency.parse({ code: 'USD', perEur: 1.08 }) }) });
    expect(historyRows()).toEqual(['1 Jan 2099$129.60/h', '12 Mar 2026$102.60/hcurrent', '1 Jan 2025$86.40/h']);
  });

  it('says so when the employee has no rate yet', async () => {
    await renderEmployee('emp-005');
    expect(screen.getByText('No rates yet.')).toBeInTheDocument();
    expect(screen.queryByText('current')).not.toBeInTheDocument();
  });

  it('links back to the register', async () => {
    const user = userEvent.setup();
    const { router } = await renderEmployee('emp-001');
    await user.click(screen.getByRole('link', { name: 'All employees' }));
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('an employee page for an id nobody has', () => {
  it('says so and links back', async () => {
    renderWithApp(routes, { route: '/emp-999' });
    expect(await screen.findByText('Employee not found: there is no employee "emp-999".')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All employees' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('treats a malformed id the same way', () => {
    renderWithApp(routes, { route: '/not-an-id' });
    expect(screen.getByText('Employee not found: there is no employee "not-an-id".')).toBeInTheDocument();
  });
});

describe('an employee page while loading and when loading fails', () => {
  it('shows a loading message until the employee arrives', async () => {
    const repository = createFakeRepository();
    const release = repository.holdReads();
    renderWithApp(routes, { repository, route: '/emp-001' });
    expect(await screen.findByText('Loading employee…')).toBeInTheDocument();
    release();
    expect(await screen.findByRole('heading', { level: 1, name: 'Adaeze Okafor' })).toBeInTheDocument();
  });

  it('says what went wrong and loads again on "Try again"', async () => {
    const user = userEvent.setup();
    const repository = createFakeRepository();
    repository.failReads(new ApiError('unavailable', 'people'));
    renderWithApp(routes, { repository, route: '/emp-001' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Employee couldn't be loaded: the People service didn't respond.",
    );

    repository.failReads(null);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Adaeze Okafor' })).toBeInTheDocument();
  });
});
