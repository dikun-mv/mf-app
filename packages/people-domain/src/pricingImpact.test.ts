import { IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { monthPricing, pricingImpact } from './pricingImpact';
import { seedEmployeeIds, seedRatesOf } from './testing/seed';

const month = (value: string) => Month.parse(value);
const date = (value: string) => IsoDate.parse(value);
const from = (value: string) => ({ validFrom: date(value) });
const load = (value: string, allocatedPersonMonths = 0.5) => ({ month: month(value), allocatedPersonMonths });

describe('monthPricing', () => {
  it('is priced from the first rate on, partly priced in the month it starts, unpriced before', () => {
    const first = date('2026-03-12');
    expect(monthPricing(month('2026-02'), first)).toBe('unpriced');
    expect(monthPricing(month('2026-03'), first)).toBe('partiallyPriced');
    expect(monthPricing(month('2026-04'), first)).toBe('priced');
  });

  it('is priced when the first rate starts on the first day of the month', () => {
    expect(monthPricing(month('2026-04'), date('2026-04-01'))).toBe('priced');
    expect(monthPricing(month('2026-03'), date('2026-04-01'))).toBe('unpriced');
  });

  it('ignores days that are not working days', () => {
    // 1 Mar 2026 is a Sunday: a first rate on Monday 2 Mar leaves no working day unpriced.
    expect(monthPricing(month('2026-03'), date('2026-03-02'))).toBe('priced');
    // 30 May 2026 is a Saturday: a first rate then leaves no working day priced.
    expect(monthPricing(month('2026-05'), date('2026-05-30'))).toBe('unpriced');
  });

  it('is unpriced with no rate at all', () => {
    expect(monthPricing(month('2026-03'), null)).toBe('unpriced');
  });

  it('is the same in every time zone', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'Pacific/Auckland', 'America/Los_Angeles'].map((zone) => {
        process.env.TZ = zone;
        return monthPricing(month('2026-03'), date('2026-03-12'));
      });
      expect(new Set(results)).toEqual(new Set(['partiallyPriced']));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('pricingImpact', () => {
  const okafor = [from('2025-01-01'), from('2026-03-12')];
  const loads = [load('2026-02'), load('2026-03'), load('2026-04'), load('2026-05', 0)];

  it('flags nothing when the edit keeps every allocated month priced', () => {
    expect(pricingImpact(okafor, [from('2025-01-01')], loads)).toEqual([]);
    expect(pricingImpact(okafor, [], [])).toEqual([]);
  });

  it('flags the months an edit prices worse, leaving out months with no allocation', () => {
    // Deleting the 2025-01-01 rate makes 12 Mar 2026 the first rate (plan T8.1): February has no
    // rate left and March loses its first eight working days. April, and May with no work, don't appear.
    expect(pricingImpact(okafor, [from('2026-03-12')], loads)).toEqual([
      { month: '2026-02', before: 'priced', after: 'unpriced', allocatedPersonMonths: 0.5 },
      { month: '2026-03', before: 'priced', after: 'partiallyPriced', allocatedPersonMonths: 0.5 },
    ]);
  });

  it('lists months oldest first whatever order the feed arrives in', () => {
    const impact = pricingImpact(okafor, [], [load('2026-04'), load('2026-02'), load('2026-03')]);
    expect(impact.map((i) => i.month)).toEqual(['2026-02', '2026-03', '2026-04']);
  });

  it('flags every allocated month when the last rate is removed', () => {
    expect(pricingImpact(okafor, [], loads).map((i) => [i.month, i.after])).toEqual([
      ['2026-02', 'unpriced'],
      ['2026-03', 'unpriced'],
      ['2026-04', 'unpriced'],
    ]);
  });

  it('moves a partly priced month to unpriced, but does not flag an improvement', () => {
    const partly = [from('2026-03-12')];
    expect(pricingImpact(partly, [from('2026-04-01')], [load('2026-03')])).toEqual([
      { month: '2026-03', before: 'partiallyPriced', after: 'unpriced', allocatedPersonMonths: 0.5 },
    ]);
    expect(pricingImpact(partly, [from('2025-01-01')], [load('2026-02'), load('2026-03')])).toEqual([]);
  });

  it('flags a retroactive correction that moves the first rate later', () => {
    expect(pricingImpact(okafor, [from('2026-01-01'), from('2026-03-12')], [load('2025-12')])).toEqual([
      { month: '2025-12', before: 'priced', after: 'unpriced', allocatedPersonMonths: 0.5 },
    ]);
  });
});

describe('the seed (plan §1)', () => {
  it('starts every employee’s first rate on the 1st of a month, so no seed month is partly priced', () => {
    for (const employeeId of seedEmployeeIds) {
      const first = seedRatesOf(employeeId)
        .map((r) => r.validFrom)
        .sort()[0];
      expect(first?.endsWith('-01')).toBe(true);
    }
  });

  it('turns partly priced the month of the later rate when an earlier one is deleted', () => {
    // The five employees with exactly two records whose later rate starts mid-month (plan §1).
    for (const employeeId of ['emp-001', 'emp-028', 'emp-034', 'emp-041', 'emp-053']) {
      const history = seedRatesOf(employeeId);
      expect(history).toHaveLength(2);
      const later = [...history].sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))[1];
      if (later === undefined) throw new Error('expected two rates');
      const impact = pricingImpact(
        history,
        [later],
        [{ month: Month.parse(later.validFrom.slice(0, 7)), allocatedPersonMonths: 0.3 }],
      );
      expect(impact.map((i) => i.after)).toEqual(['partiallyPriced']);
    }
  });
});
