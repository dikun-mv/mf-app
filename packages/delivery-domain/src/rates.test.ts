import { IsoDate, Month } from '@baseline/host-contract';
import { OKAFOR_MARCH_2026_SLICES, OKAFOR_RATE_RECORDS, RateRecord } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { type RateInput, sliceMonth } from './rates';
import { seedRatesOf } from './testing/seed';

const rateFrom = (validFrom: string, hourlyCost: number): RateInput => ({
  validFrom: IsoDate.parse(validFrom),
  hourlyCost,
});
const month = (value: string) => Month.parse(value);

describe('sliceMonth', () => {
  it('splits March 2026 at the 12th into 8 days at the old rate and 14 at the new', () => {
    const slices = sliceMonth(month('2026-03'), [rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95)]);
    expect(slices).toEqual([
      { from: '2026-03-01', toExclusive: '2026-03-12', workingDays: 8, hourlyCost: 80 },
      { from: '2026-03-12', toExclusive: '2026-04-01', workingDays: 14, hourlyCost: 95 },
    ]);
  });

  it('prices the validFrom day itself at the new rate', () => {
    // 2026-03-12 is a Thursday.
    const slices = sliceMonth(month('2026-03'), [rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95)]);
    expect(slices[1]?.from).toBe('2026-03-12');
    expect(slices[1]?.hourlyCost).toBe(95);
  });

  it('gives one slice when no change falls inside the month', () => {
    const rates = [rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95)];
    expect(sliceMonth(month('2026-02'), rates)).toHaveLength(1);
    expect(sliceMonth(month('2026-04'), rates)).toHaveLength(1);
    expect(sliceMonth(month('2026-04'), rates)[0]?.hourlyCost).toBe(95);
  });

  it('treats a change on the first of the month as no change inside it', () => {
    const slices = sliceMonth(month('2026-04'), [rateFrom('2025-01-01', 80), rateFrom('2026-04-01', 95)]);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.hourlyCost).toBe(95);
  });

  it('gives N+1 slices for N changes, in any input order', () => {
    const rates = [rateFrom('2026-03-20', 120), rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95)];
    const slices = sliceMonth(month('2026-03'), rates);
    expect(slices.map((slice) => slice.hourlyCost)).toEqual([80, 95, 120]);
    expect(slices.map((slice) => slice.workingDays)).toEqual([8, 6, 8]);
  });

  it('makes the days before the first rate an unpriced slice', () => {
    const slices = sliceMonth(month('2026-03'), [rateFrom('2026-03-12', 95)]);
    expect(slices.map((slice) => slice.hourlyCost)).toEqual([null, 95]);
    expect(slices.map((slice) => slice.workingDays)).toEqual([8, 14]);
  });

  it('is one unpriced slice when the first rate starts after the month', () => {
    const slices = sliceMonth(month('2026-03'), [rateFrom('2026-05-01', 95)]);
    expect(slices).toEqual([{ from: '2026-03-01', toExclusive: '2026-04-01', workingDays: 22, hourlyCost: null }]);
  });

  it('is one unpriced slice with no rates at all', () => {
    expect(sliceMonth(month('2026-03'), [])).toHaveLength(1);
    expect(sliceMonth(month('2026-03'), [])[0]?.hourlyCost).toBeNull();
  });

  it('lets the later record win when two share a validFrom', () => {
    const slices = sliceMonth(month('2026-03'), [rateFrom('2026-03-12', 95), rateFrom('2026-03-12', 99)]);
    expect(slices.map((slice) => slice.hourlyCost)).toEqual([null, 99]);
  });

  it('does not mutate its input', () => {
    const rates = [rateFrom('2026-03-20', 120), rateFrom('2025-01-01', 80)];
    const copy = structuredClone(rates);
    sliceMonth(month('2026-03'), rates);
    expect(rates).toEqual(copy);
  });

  it('reads the seed: A. Okafor (emp-001) splits March 2026 as in the brief', () => {
    const slices = sliceMonth(month('2026-03'), seedRatesOf('emp-001'));
    expect(slices.map((slice) => [slice.workingDays, slice.hourlyCost])).toEqual([
      [8, 80],
      [14, 95],
    ]);
  });

  it("matches People's conformance fixture: A. Okafor's March 2026 slices (D7)", () => {
    // The records and the expected slices come from people-contract, so what People publishes is what is pinned.
    const records = RateRecord.array().parse(OKAFOR_RATE_RECORDS);
    const slices = sliceMonth(month('2026-03'), records);
    expect(
      slices.map(({ from, toExclusive, workingDays, hourlyCost }) => ({ from, toExclusive, workingDays, hourlyCost })),
    ).toEqual(OKAFOR_MARCH_2026_SLICES);
  });
});
