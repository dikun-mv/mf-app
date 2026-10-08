import { EmployeeMonthLoad } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import { ApiError, RealtimeStatusContext } from '../../../shared/api';
import { MONTH_LOADS, createFakeRepository, renderWithApp } from '../../../shared/testing';
import { RegisterScreen } from './RegisterScreen';

const capacityOf = (name: RegExp) => within(screen.getByRole('row', { name })).getAllByRole('cell').at(-1);

async function renderRegister(options: Parameters<typeof renderWithApp>[1] = {}) {
  const app = renderWithApp(<RegisterScreen />, options);
  await screen.findByRole('table', { name: 'Employees' });
  return app;
}

describe('the register’s Capacity column', () => {
  it('lists the months over capacity, and nothing for an employee within capacity', async () => {
    await renderRegister();
    expect(screen.getByRole('columnheader', { name: 'Capacity' })).toBeInTheDocument();
    expect(
      await within(screen.getByRole('row', { name: /Lena Okafor/ })).findByText('Over capacity · Sep 2026'),
    ).toBeInTheDocument();
    expect(capacityOf(/Milan Brandt/)).toHaveTextContent('Over capacity · Jun 2026');
    expect(capacityOf(/Adaeze Okafor/)).toHaveTextContent('');
    expect(capacityOf(/Samira Haddad/)).toHaveTextContent('');
  });

  it('lists every month over capacity, oldest first', async () => {
    const loads = [
      ...MONTH_LOADS,
      EmployeeMonthLoad.parse({
        employeeId: 'emp-003',
        month: '2026-05',
        allocatedPersonMonths: 1.1,
        overCapacity: true,
        causingAllocationId: 'alloc-2',
      }),
    ];
    await renderRegister({ repository: createFakeRepository({ employeeMonthLoads: loads }) });
    expect(
      await within(screen.getByRole('row', { name: /Milan Brandt/ })).findByText('Over capacity · May 2026, Jun 2026'),
    ).toBeInTheDocument();
  });

  it('claims nothing, neither over capacity nor unknown, while the feed is still loading', async () => {
    const repository = createFakeRepository();
    const release = repository.holdLoads();
    await renderRegister({ repository });
    expect(screen.queryByText(/Capacity unknown/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Over capacity/)).not.toBeInTheDocument();
    expect(capacityOf(/Milan Brandt/)).toHaveTextContent('');

    release();
    expect(await screen.findByText('Over capacity · Jun 2026')).toBeInTheDocument();
  });
});

describe('the register when Delivery can’t be reached', () => {
  it('says capacity is unknown, in the banner and in every row, and still lists employees and rates', async () => {
    const repository = createFakeRepository();
    repository.failLoads(new ApiError('unavailable', 'delivery'));
    await renderRegister({ repository });

    expect(
      await screen.findByText(/Delivery's data can't be reached. Employees and rates are unaffected./),
    ).toBeInTheDocument();
    expect(screen.getByText('Capacity unknown:')).toBeInTheDocument();
    expect(capacityOf(/Adaeze Okafor/)).toHaveTextContent('unknown');
    expect(capacityOf(/Milan Brandt/)).toHaveTextContent('unknown');
    expect(screen.queryByText(/Over capacity/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Adaeze Okafor/ })).getByText('€95.00/h')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search name or role' })).toBeInTheDocument();
  });

  it('treats a lost realtime connection as unknown, because the rows it holds may be stale', async () => {
    renderWithApp(
      <RealtimeStatusContext.Provider value={{ people: 'live', delivery: 'down' }}>
        <RegisterScreen />
      </RealtimeStatusContext.Provider>,
    );
    expect(await screen.findByText('Capacity unknown:')).toBeInTheDocument();
    expect(capacityOf(/Milan Brandt/)).toHaveTextContent('unknown');
  });
});
