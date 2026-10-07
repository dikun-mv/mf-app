import { describe, expect, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { TextField } from './TextField';

describe('TextField', () => {
  it('labels the input, so the label is its accessible name', () => {
    render(<TextField label="Hourly cost (EUR)" defaultValue="95.00" />);
    const input = screen.getByRole('textbox', { name: 'Hourly cost (EUR)' });
    expect(input).toBe(screen.getByLabelText('Hourly cost (EUR)'));
    expect(input).toHaveValue('95.00');
  });

  it('keeps the label for assistive technology when hideLabel is set', () => {
    render(<TextField label="Search name or role" hideLabel type="search" />);
    expect(screen.getByRole('searchbox', { name: 'Search name or role' })).toBeInTheDocument();
  });

  it('describes the input by its hint', () => {
    render(<TextField label="Valid from" hint="A rate runs until the next one starts." />);
    const input = screen.getByRole('textbox', { name: 'Valid from' });
    expect(input).toHaveAccessibleDescription('A rate runs until the next one starts.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the input invalid and describes it by the error first, then the hint', () => {
    render(
      <TextField
        label="Valid from"
        hint="Past dates are allowed."
        error="Another rate already starts on 12 Mar 2026."
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Valid from' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Another rate already starts on 12 Mar 2026. Past dates are allowed.');
  });

  it('keeps a describedby the caller sets', () => {
    render(
      <>
        <p id="extra">Entered in the display currency.</p>
        <TextField label="Hourly cost" error="Enter an amount." aria-describedby="extra" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Hourly cost' })).toHaveAccessibleDescription(
      'Enter an amount. Entered in the display currency.',
    );
  });

  it('forwards its ref to the input and passes input attributes on, as register needs', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField ref={ref} label="Amount" name="amount" inputMode="decimal" />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('name', 'amount');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('reports typing through onChange', async () => {
    const onChange = rs.fn();
    render(<TextField label="Name" onChange={onChange} />);
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Name' }), 'Hi');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Hi');
  });

  it('uses the id it is given, and a generated one otherwise', () => {
    render(
      <>
        <TextField label="First" id="first" />
        <TextField label="Second" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveAttribute('id', 'first');
    expect(screen.getByRole('textbox', { name: 'Second' }).id).not.toBe('');
  });

  it('can be disabled', () => {
    render(<TextField label="Name" disabled />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
  });
});
