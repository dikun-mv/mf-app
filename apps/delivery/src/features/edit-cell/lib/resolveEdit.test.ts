import { AllocationId } from '@baseline/delivery-contract';
import type { DisplayUnit } from '@baseline/delivery-domain';
import { Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { employee, rate } from '../../../shared/testing';
import { openingText, resolveEdit, type EditInput } from './resolveEdit';

// March 2026 has 22 working days, so one person-month of a 40 h/week employee is 176 h.
const MARCH = Month.parse('2026-03');
const priced = { ...employee('emp-001', 'Adaeze Okafor'), rates: [rate('rate-1', 'emp-001', '2025-01-01', 100)] };
const REFUSAL = "Can't edit the cost here: 8 of 22 working days are before the first rate (12 Mar 2026).";

const stored = {
  allocationId: AllocationId.parse('alloc-1'),
  month: MARCH,
  personMonths: 0.4,
  exact: 0.4,
  euroEditRefusal: null,
};
const empty = { ...stored, allocationId: null, personMonths: 0, exact: 0 };

const edit = (draft: string, overrides: Partial<EditInput> = {}) =>
  resolveEdit({ draft, opened: '0.40', unit: 'personMonths', cell: stored, employee: priced, perEur: 1, ...overrides });

describe('openingText', () => {
  it.each<[DisplayUnit, number, string]>([
    ['personMonths', 0.5, '0.50'],
    ['hours', 87.9824, '87.98'],
    ['percent', 50, '50.0'],
    ['cost', 7880, '7880.00'],
  ])('writes a stored %s value to its decimals, without symbols', (unit, exact, text) => {
    expect(openingText(unit, { allocationId: stored.allocationId, exact })).toBe(text);
  });

  it('opens empty where nothing is stored', () => {
    expect(openingText('personMonths', { allocationId: null, exact: 0 })).toBe('');
  });
});

describe('resolveEdit', () => {
  it('saves a changed person-month value as typed', () => {
    expect(edit('0.3')).toEqual({ kind: 'save', amount: 0.3 });
  });

  it('converts hours, percent and cost to person-months', () => {
    expect(edit('88', { unit: 'hours', opened: '70.40' })).toEqual({ kind: 'save', amount: 0.5 });
    expect(edit('50', { unit: 'percent', opened: '40.0' })).toEqual({ kind: 'save', amount: 0.5 });
    expect(edit('8800', { unit: 'cost', opened: '7040.00' })).toEqual({ kind: 'save', amount: 0.5 });
  });

  it('converts a cost in the display currency back through EUR (D11)', () => {
    expect(edit('9504', { unit: 'cost', opened: '7603.20', perEur: 1.08 })).toEqual({ kind: 'save', amount: 0.5 });
  });

  it('is unchanged when the draft is the text the editor opened with, or equals what is stored', () => {
    expect(edit('0.40')).toEqual({ kind: 'unchanged' });
    expect(edit('  0.40 ')).toEqual({ kind: 'unchanged' });
    expect(edit('0.4')).toEqual({ kind: 'unchanged' });
  });

  it('ignores float noise between a typed value and the stored one', () => {
    const cell = { ...stored, personMonths: 0.5, exact: 7880.000000000001 };
    expect(edit('7880', { unit: 'cost', opened: '7880.00', cell })).toEqual({ kind: 'unchanged' });
  });

  it('writes a touched draft that restores the opening value after the cell changed elsewhere (D37)', () => {
    const elsewhere = { ...stored, personMonths: 0.75, exact: 0.75 };
    expect(edit('0.5', { opened: '0.50', cell: elsewhere })).toEqual({ kind: 'save', amount: 0.5 });
    const hours = { ...stored, personMonths: 0.75, exact: 132 };
    expect(edit('80', { unit: 'hours', opened: '80.00', cell: hours })).toEqual({ kind: 'save', amount: 80 / 176 });
  });

  it('leaves an untouched draft alone even when the cell changed elsewhere meanwhile', () => {
    const elsewhere = { ...stored, personMonths: 0.75, exact: 0.75 };
    expect(edit('0.50', { opened: '0.50', cell: elsewhere })).toEqual({ kind: 'unchanged' });
  });

  it('leaves a cell shown rounded alone: its opening text is not a new value', () => {
    const rounded = { ...stored, personMonths: 0.499, exact: 87.824 };
    expect(edit('87.82', { unit: 'hours', opened: '87.82', cell: rounded })).toEqual({ kind: 'unchanged' });
  });

  it('is unchanged when the value equals what is stored now, whatever the editor opened with (D37)', () => {
    expect(edit('0.6', { cell: { ...stored, personMonths: 0.6 } })).toEqual({ kind: 'unchanged' });
  });

  it('treats zero in a cell with nothing stored as unchanged', () => {
    expect(edit('0', { opened: '', cell: empty })).toEqual({ kind: 'unchanged' });
    expect(edit('', { opened: '', cell: empty })).toEqual({ kind: 'unchanged' });
    expect(edit('0.25', { opened: '', cell: empty })).toEqual({ kind: 'save', amount: 0.25 });
  });

  it.each([
    ['', /Enter an amount/],
    ['abc', /Enter a number/],
    ['0,5', /Enter a number/],
    ['-1', /can't be negative/],
  ])('rejects %j with a sentence', (draft, message) => {
    const outcome = edit(draft);
    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' && outcome.message).toMatch(message);
  });

  it('refuses a € edit in a partly priced or unpriced month with the cell’s reason (D17)', () => {
    const outcome = edit('5000', { unit: 'cost', opened: '5320.00', cell: { ...stored, euroEditRefusal: REFUSAL } });
    expect(outcome).toEqual({ kind: 'rejected', message: REFUSAL });
  });

  it('still accepts hours, person-months and % in that month', () => {
    const cell = { ...stored, euroEditRefusal: REFUSAL };
    expect(edit('0.3', { cell })).toEqual({ kind: 'save', amount: 0.3 });
    expect(edit('52.8', { unit: 'hours', opened: '70.40', cell })).toEqual({ kind: 'save', amount: 0.3 });
  });

  it('rejects hours and cost while People’s data is missing', () => {
    const outcome = edit('88', { unit: 'hours', opened: '70.40', employee: null });
    expect(outcome.kind === 'rejected' && outcome.message).toMatch(/People's data/);
  });
});
