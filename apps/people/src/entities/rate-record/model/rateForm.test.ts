import { Currency, IsoDate } from '@baseline/host-contract';
import { RateRecordId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { rateFormSchema, refusalOf } from './rateForm';

const EUR = Currency.parse({ code: 'EUR', perEur: 1 });
const USD = Currency.parse({ code: 'USD', perEur: 1.08 });

/** The messages of every field that was refused, by field. */
function refused(
  schema: ReturnType<typeof rateFormSchema>,
  fields: { validFrom: string; amount: string },
): Record<string, string> | null {
  const result = schema.safeParse(fields);
  if (result.success) return null;
  const messages: Record<string, string> = {};
  for (const issue of result.error.issues) messages[String(issue.path[0])] = issue.message;
  return messages;
}

describe('rateFormSchema', () => {
  it('gives the day, the amount as entered, and the cost in EUR', () => {
    const result = rateFormSchema(USD).parse({ validFrom: '2026-11-01', amount: '108' });
    expect(result.validFrom).toBe('2026-11-01');
    expect(result.entered).toBe(108);
    expect(result.hourlyCost).toBeCloseTo(100, 10);
  });

  it('reads an amount the way parseAmount does, with grouping and a currency sign', () => {
    expect(rateFormSchema(EUR).parse({ validFrom: '2026-11-01', amount: '€1,234.50' }).hourlyCost).toBe(1234.5);
  });

  it('refuses a missing or impossible day', () => {
    expect(refused(rateFormSchema(EUR), { validFrom: '', amount: '98' })).toEqual({
      validFrom: 'Enter the day the rate starts.',
    });
    expect(refused(rateFormSchema(EUR), { validFrom: '2026-02-30', amount: '98' })).toEqual({
      validFrom: 'Enter a valid date.',
    });
  });

  it.each([
    ['', 'Enter the hourly cost.'],
    ['abc', 'Enter the cost as a number, for example 98.00.'],
    ['0,5', 'Enter the cost as a number, for example 98.00.'],
    ['-3', 'The cost must be above 0.'],
    ['0', 'The cost must be above 0.'],
  ])('refuses the amount "%s"', (amount, message) => {
    expect(refused(rateFormSchema(EUR), { validFrom: '2026-11-01', amount })).toEqual({ amount: message });
  });

  it('refuses both fields at once, each with its own message', () => {
    expect(refused(rateFormSchema(EUR), { validFrom: '', amount: '' })).toEqual({
      validFrom: 'Enter the day the rate starts.',
      amount: 'Enter the hourly cost.',
    });
  });
});

describe('refusalOf', () => {
  const id = RateRecordId.parse('rate-1');

  it('puts a clash of start days on the day field, naming the day', () => {
    expect(refusalOf({ code: 'duplicateValidFrom', validFrom: IsoDate.parse('2026-03-12'), ids: [id] })).toEqual({
      field: 'validFrom',
      message: 'Another rate already starts on 12 Mar 2026.',
    });
  });

  it('puts a cost that is not above 0 on the amount field', () => {
    expect(refusalOf({ code: 'nonPositiveRate', id, hourlyCost: 0 })).toEqual({
      field: 'amount',
      message: 'The cost must be above 0.',
    });
  });

  it('shows the cases a checked form cannot reach for the whole form', () => {
    expect(refusalOf({ code: 'notFound', id }).field).toBe('root.server');
    expect(refusalOf({ code: 'duplicateId', id }).field).toBe('root.server');
  });
});
