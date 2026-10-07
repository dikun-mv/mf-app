import { createRef } from 'react';
import { accessibleDescription, getByLabelText, getByRole, render, type } from '../../testing/dom';
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
    const select = getByRole('combobox', { name: 'Currency' });
    expect(select).toBe(getByLabelText('Currency'));
    expect(select.querySelectorAll('option')).toHaveLength(3);
  });

  it('reports the chosen option through onChange', () => {
    const onChange = rs.fn();
    render(
      <Select label="Currency" defaultValue="EUR" onChange={onChange}>
        {currencies()}
      </Select>,
    );
    const select = getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement;
    type(select, 'USD');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select.value).toBe('USD');
  });

  it('describes the select by its hint and marks it invalid with an error', () => {
    render(
      <Select label="Employee" hint="Only people not yet on this item." error="Choose an employee.">
        <option value="">Choose…</option>
      </Select>,
    );
    const select = getByRole('combobox', { name: 'Employee' });
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(accessibleDescription(select)).toBe('Choose an employee. Only people not yet on this item.');
  });

  it('keeps the label for assistive technology when hideLabel is set', () => {
    render(
      <Select label="User" hideLabel>
        <option>Demo Planner</option>
      </Select>,
    );
    expect(getByRole('combobox', { name: 'User' })).toBeTruthy();
  });

  it('forwards its ref to the select and passes attributes on', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref} label="Employee" name="employee" disabled>
        {currencies()}
      </Select>,
    );
    const select = getByRole('combobox', { name: 'Employee' });
    expect(ref.current).toBe(select);
    expect(select.getAttribute('name')).toBe('employee');
    expect((select as HTMLSelectElement).disabled).toBe(true);
  });
});
