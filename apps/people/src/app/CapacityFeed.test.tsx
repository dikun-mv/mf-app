import { EmployeeMonthLoad } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { act, screen, within } from '@testing-library/react';
import { EmployeeScreen } from '../pages/employee';
import { RegisterScreen } from '../pages/register';
import { renderWithApp } from '../shared/testing';
import { RealtimeProvider } from './RealtimeProvider';

/** Delivery's feed reaches the screens through the app's `RealtimeProvider` for the `delivery` instance (D29). */
const over = (employeeId: string, month: string, personMonths: number) =>
  EmployeeMonthLoad.parse({
    employeeId,
    month,
    allocatedPersonMonths: personMonths,
    overCapacity: true,
    causingAllocationId: 'alloc-9',
  });

describe('capacity follows Delivery’s feed', () => {
  it('shows a month that goes over capacity in the register while the page is open', async () => {
    const { repository } = renderWithApp(
      <RealtimeProvider instance="delivery">
        <RegisterScreen />
      </RealtimeProvider>,
    );
    const samira = async () =>
      within(await screen.findByRole('row', { name: /Samira Haddad/ }))
        .getAllByRole('cell')
        .at(-1);
    expect(await samira()).toHaveTextContent('');

    act(() => {
      repository.emit({ collection: 'employeeMonthLoads', action: 'create', record: over('emp-004', '2026-07', 1.25) });
    });
    expect(await screen.findByText('Over capacity · Jul 2026')).toBeInTheDocument();
  });

  it('shows it on the employee page too', async () => {
    const { repository } = renderWithApp(
      [
        {
          path: ':employeeId',
          element: (
            <RealtimeProvider instance="delivery">
              <EmployeeScreen />
            </RealtimeProvider>
          ),
        },
      ],
      { route: '/emp-001' },
    );
    expect(await screen.findByText('Within capacity')).toBeInTheDocument();

    act(() => {
      repository.emit({ collection: 'employeeMonthLoads', action: 'create', record: over('emp-001', '2026-04', 1.3) });
    });
    expect(await screen.findByText('Over capacity · 1 month')).toBeInTheDocument();
    expect(screen.getByText(/Over capacity in Apr 2026: 130.0% of capacity \(1.30 PM\)/)).toBeInTheDocument();
  });

  it('says capacity is unknown while the connection is down, and known again when it is back', async () => {
    const { repository } = renderWithApp(
      <RealtimeProvider instance="delivery">
        <RegisterScreen />
      </RealtimeProvider>,
    );
    expect(await screen.findByText('Over capacity · Jun 2026')).toBeInTheDocument();

    act(() => {
      repository.disconnect('delivery');
    });
    expect(await screen.findByText('Capacity unknown:')).toBeInTheDocument();
    expect(screen.queryByText('Over capacity · Jun 2026')).not.toBeInTheDocument();

    act(() => {
      repository.connect('delivery');
    });
    expect(await screen.findByText('Over capacity · Jun 2026')).toBeInTheDocument();
    expect(screen.queryByText('Capacity unknown:')).not.toBeInTheDocument();
  });
});
