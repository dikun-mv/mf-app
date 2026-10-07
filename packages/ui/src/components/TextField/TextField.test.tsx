import { createRef } from 'react';
import { accessibleDescription, getByLabelText, getByRole, render, type } from '../../testing/dom';
import { TextField } from './TextField';

describe('TextField', () => {
  it('labels the input, so the label is its accessible name', () => {
    render(<TextField label="Hourly cost (EUR)" defaultValue="95.00" />);
    const input = getByRole('textbox', { name: 'Hourly cost (EUR)' });
    expect(input).toBe(getByLabelText('Hourly cost (EUR)'));
    expect((input as HTMLInputElement).value).toBe('95.00');
  });

  it('keeps the label for assistive technology when hideLabel is set', () => {
    render(<TextField label="Search name or role" hideLabel type="search" />);
    expect(getByRole('searchbox', { name: 'Search name or role' })).toBeTruthy();
  });

  it('describes the input by its hint', () => {
    render(<TextField label="Valid from" hint="A rate runs until the next one starts." />);
    const input = getByRole('textbox', { name: 'Valid from' });
    expect(accessibleDescription(input)).toBe('A rate runs until the next one starts.');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('marks the input invalid and describes it by the error first, then the hint', () => {
    render(
      <TextField
        label="Valid from"
        hint="Past dates are allowed."
        error="Another rate already starts on 12 Mar 2026."
      />,
    );
    const input = getByRole('textbox', { name: 'Valid from' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(accessibleDescription(input)).toBe('Another rate already starts on 12 Mar 2026. Past dates are allowed.');
  });

  it('keeps a describedby the caller sets', () => {
    render(
      <>
        <p id="extra">Entered in the display currency.</p>
        <TextField label="Hourly cost" error="Enter an amount." aria-describedby="extra" />
      </>,
    );
    expect(accessibleDescription(getByRole('textbox', { name: 'Hourly cost' }))).toBe(
      'Enter an amount. Entered in the display currency.',
    );
  });

  it('forwards its ref to the input and passes input attributes on, as register needs', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField ref={ref} label="Amount" name="amount" inputMode="decimal" />);
    const input = getByRole('textbox', { name: 'Amount' });
    expect(ref.current).toBe(input);
    expect(input.getAttribute('name')).toBe('amount');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('reports typing through onChange', () => {
    const onChange = rs.fn();
    render(<TextField label="Name" onChange={onChange} />);
    type(getByRole('textbox', { name: 'Name' }) as HTMLInputElement, 'Reconciliation');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses the id it is given, and a generated one otherwise', () => {
    render(
      <>
        <TextField label="First" id="first" />
        <TextField label="Second" />
      </>,
    );
    expect(getByRole('textbox', { name: 'First' }).id).toBe('first');
    expect(getByRole('textbox', { name: 'Second' }).id).not.toBe('');
  });

  it('can be disabled', () => {
    render(<TextField label="Name" disabled />);
    expect((getByRole('textbox', { name: 'Name' }) as HTMLInputElement).disabled).toBe(true);
  });
});
