import { EmployeeMonthLoad } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import { ApiError } from '../../../shared/api';
import { MONTH_LOADS, createFakeRepository, renderWithApp } from '../../../shared/testing';
import { EmployeeScreen } from './EmployeeScreen';

const routes = [{ path: ':employeeId', element: <EmployeeScreen /> }];

describe('an employee page’s capacity', () => {
  it('says Within capacity when no month is over', async () => {
    renderWithApp(routes, { route: '/emp-001' });
    expect(await screen.findByText('Within capacity')).toBeInTheDocument();
    expect(screen.queryByText(/Over capacity/)).not.toBeInTheDocument();
  });

  it('says Within capacity for an employee the feed has no row for', async () => {
    renderWithApp(routes, { route: '/emp-004' });
    expect(await screen.findByText('Within capacity')).toBeInTheDocument();
  });

  it('gives the month, its share of capacity and its person-months when one month is over', async () => {
    renderWithApp(routes, { route: '/emp-003' });
    expect(await screen.findByText('Over capacity · 1 month')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Over capacity in Jun 2026: 118.0% of capacity (1.18 PM) across all projects. The causing assignment is named in Delivery.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Within capacity')).not.toBeInTheDocument();
  });

  it('lists each month when several are over', async () => {
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
    renderWithApp(routes, { route: '/emp-003', repository: createFakeRepository({ employeeMonthLoads: loads }) });
    expect(await screen.findByText('Over capacity · 2 months')).toBeInTheDocument();
    expect(screen.getByText('May 2026: 110.0% of capacity (1.10 PM)')).toBeInTheDocument();
    expect(screen.getByText('Jun 2026: 118.0% of capacity (1.18 PM)')).toBeInTheDocument();
  });

  it('says capacity is unknown when Delivery can’t be reached, and the page still works', async () => {
    const repository = createFakeRepository();
    repository.failLoads(new ApiError('unavailable', 'delivery'));
    renderWithApp(routes, { route: '/emp-003', repository });
    expect(await screen.findByText('Capacity unknown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Milan Brandt' })).toBeInTheDocument();
    expect(screen.getByText('€100.00/h')).toBeInTheDocument();
    expect(screen.queryByText(/Over capacity/)).not.toBeInTheDocument();
    expect(screen.queryByText('Within capacity')).not.toBeInTheDocument();
  });
});
