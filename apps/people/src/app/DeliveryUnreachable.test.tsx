import { describe, expect, it } from '@rstest/core';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../shared/api';
import { createFakeRepository, testContext } from '../shared/testing';
import App from './App';

// T5.5: Delivery's load feed is the other team's data, so when it can't be reached People shows "capacity
// unknown" and carries on (screens 2.2). These run the whole app, as the browser does, with Delivery down.

/** Delivery down from the start: the read fails and the realtime connection never comes up. */
function deliveryDown() {
  const repository = createFakeRepository();
  repository.failLoads(new ApiError('unavailable', 'delivery'));
  return repository;
}

const capacityCells = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').at(-1)?.textContent);

describe('People with Delivery unreachable', () => {
  it('shows the banner and reads unknown for every employee, with names, roles and rates in place', async () => {
    window.history.replaceState({}, '', '/people');
    const repository = deliveryDown();
    render(<App ctx={testContext()} repository={repository} />);
    act(() => {
      repository.disconnect('delivery');
    });

    expect(await screen.findByText('Capacity unknown:')).toBeInTheDocument();
    expect(
      screen.getByText(/Delivery's data can't be reached\. Employees and rates are unaffected\./),
    ).toBeInTheDocument();
    expect(capacityCells()).toEqual(Array(6).fill('unknown'));
    const row = within(screen.getByRole('row', { name: /Adaeze Okafor/ }));
    expect(row.getByText('Tech Lead')).toBeInTheDocument();
    expect(row.getByText('€95.00/h')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });

  it('keeps the employee page working', async () => {
    window.history.replaceState({}, '', '/people/emp-001');
    const repository = deliveryDown();
    render(<App ctx={testContext()} repository={repository} />);
    act(() => {
      repository.disconnect('delivery');
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Adaeze Okafor' })).toBeInTheDocument();
    expect(await screen.findByText('Capacity unknown')).toBeInTheDocument();
    expect(screen.getByText('€95.00/h')).toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });

  it('shows capacity again once Delivery is back, without a reload', async () => {
    window.history.replaceState({}, '', '/people');
    const repository = deliveryDown();
    render(<App ctx={testContext()} repository={repository} />);
    act(() => {
      repository.disconnect('delivery');
    });
    expect(await screen.findByText('Capacity unknown:')).toBeInTheDocument();

    repository.failLoads(null);
    act(() => {
      repository.connect('delivery');
    });
    // The first read was still retrying (one retry after a second, D33), so the answer can take a moment.
    expect(await screen.findByText('Over capacity · Jun 2026', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Capacity unknown:')).not.toBeInTheDocument();
    expect(capacityCells()).toContain('Over capacity · Sep 2026');
    window.history.replaceState({}, '', '/');
  });

  it('does not stop the rate editor: a rate can still be added', async () => {
    window.history.replaceState({}, '', '/people/emp-001');
    const user = userEvent.setup();
    const repository = deliveryDown();
    render(<App ctx={testContext()} repository={repository} />);
    act(() => {
      repository.disconnect('delivery');
    });
    await screen.findByRole('heading', { level: 1, name: 'Adaeze Okafor' });

    const form = within(screen.getByRole('form', { name: 'Add a rate' }));
    await user.type(form.getByLabelText('Valid from'), '2026-11-01');
    await user.type(form.getByLabelText(/Hourly cost/), '98');
    await user.click(form.getByRole('button', { name: 'Add rate' }));
    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });
});
