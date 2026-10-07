import { IsoDate } from '@baseline/host-contract';
import { EmployeeId, RateRecordId, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { applyRateChangeSet, touchedRateIds } from './rateChangeSet';
import { EMPTY_RATE_CHANGE_SET } from './repository';

const rate = (n: number, validFrom: string, hourlyCost: number): RateRecord => ({
  id: RateRecordId.parse(`rate-${String(n)}`),
  employeeId: EmployeeId.parse('emp-001'),
  validFrom: IsoDate.parse(validFrom),
  hourlyCost,
});

const a = rate(1, '2025-01-01', 80);
const b = rate(2, '2026-03-12', 95);

describe('applyRateChangeSet', () => {
  it('deletes, replaces and appends', () => {
    const corrected = rate(2, '2026-03-12', 97);
    const added = rate(3, '2026-11-01', 98);
    expect(applyRateChangeSet([a, b], { create: [added], update: [corrected], delete: [a.id] })).toEqual([
      corrected,
      added,
    ]);
  });

  it('is the identity for an empty set, without touching the input', () => {
    const records = [a, b];
    expect(applyRateChangeSet(records, EMPTY_RATE_CHANGE_SET)).toEqual([a, b]);
    expect(records).toEqual([a, b]);
  });

  it('refuses a set made against another state', () => {
    expect(() => applyRateChangeSet([a], { ...EMPTY_RATE_CHANGE_SET, update: [b] })).toThrow(/rate-2/);
  });
});

describe('touchedRateIds', () => {
  it('lists each id once', () => {
    expect(touchedRateIds({ create: [rate(3, '2026-11-01', 1)], update: [b], delete: [a.id, b.id] })).toEqual([
      'rate-3',
      'rate-2',
      'rate-1',
    ]);
  });
});
