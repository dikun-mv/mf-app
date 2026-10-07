import { describe, expect, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Select } from './Select';

function currencies() {
  return (
    <>
      <option value="EUR">EUR</option>
      <option value="USD">USD</option>
      <option value="GBP">GBP</option>
    </>
  );
}

describe('Select', () => {
  it('labels the select, so the label is its accessible name', () => {
    render(<Select label="Currency">{currencies()}</Select>);
    const select = screen.getByRole('combobox', { name: 'Currency' });
    expect(select).toBe(screen.getByLabelText('Currency'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('reports the chosen option through onChange', async () => {
    const onChange = rs.fn();
    render(
      <Select label="Currency" defaultValue="EUR" onChange={onChange}>
        {currencies()}
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Currency' });
    await userEvent.setup().selectOptions(select, 'USD');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue('USD');
  });

  it('describes the select by its hint and marks it invalid with an error', () => {
    render(
      <Select label="Employee" hint="Only people not yet on this item." error="Choose an employee.">
        <option value="">Choose…</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Employee' });
    expect(select).toBeInvalid();
    expect(select).toHaveAccessibleDescription('Choose an employee. Only people not yet on this item.');
  });

  it('keeps the label for assistive technology when hideLabel is set', () => {
    render(
      <Select label="User" hideLabel>
        <option>Demo Planner</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'User' })).toBeInTheDocument();
  });

  it('forwards its ref to the select and passes attributes on', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref} label="Employee" name="employee" disabled>
        {currencies()}
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Employee' });
    expect(ref.current).toBe(select);
    expect(select).toHaveAttribute('name', 'employee');
    expect(select).toBeDisabled();
  });
});
