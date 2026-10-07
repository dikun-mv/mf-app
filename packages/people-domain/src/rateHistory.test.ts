import { IsoDate } from '@baseline/host-contract';
import { RateRecord, RateRecordId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import fc from 'fast-check';
import { newRateRecordId } from './ids';
import { addRate, checkRateHistory, correctRate, historyOf, rateOn, removeRate } from './rateHistory';
import { seedRateRecords, seedRatesOf } from './testing/seed';

const rate = (id: string, validFrom: string, hourlyCost: number): RateRecord =>
  RateRecord.parse({ id, employeeId: 'emp-001', validFrom, hourlyCost });

const okafor = [rate('rate-001', '2025-01-01', 80), rate('rate-002', '2026-03-12', 95)];
const id = (value: string) => RateRecordId.parse(value);

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('historyOf', () => {
  it('returns one employee’s records, oldest first', () => {
    const records = [
      rate('rate-002', '2026-03-12', 95),
      { ...rate('rate-900', '2024-01-01', 10), employeeId: RateRecord.shape.employeeId.parse('emp-002') },
      rate('rate-001', '2025-01-01', 80),
    ];
    expect(historyOf(records, RateRecord.shape.employeeId.parse('emp-001')).map((r) => r.id)).toEqual([
      'rate-001',
      'rate-002',
    ]);
  });
});

describe('historyOf ordering', () => {
  it('puts two records on one day in id order, so the result never depends on input order', () => {
    const a = rate('rate-010', '2026-03-12', 90);
    const b = rate('rate-020', '2026-03-12', 95);
    const employeeId = a.employeeId;
    expect(historyOf([b, a], employeeId).map((r) => r.id)).toEqual(['rate-010', 'rate-020']);
    expect(historyOf([a, b], employeeId).map((r) => r.id)).toEqual(['rate-010', 'rate-020']);
  });
});

describe('checkRateHistory', () => {
  it('accepts the seed: 150 records, 1-4 per person, all valid', () => {
    expect(seedRateRecords).toHaveLength(150);
    const employeeIds = new Set(seedRateRecords.map((r) => r.employeeId));
    for (const employeeId of employeeIds) expect(checkRateHistory(seedRatesOf(employeeId))).toEqual([]);
  });

  it('flags two records on one day', () => {
    expect(checkRateHistory([...okafor, rate('rate-003', '2026-03-12', 99)])).toEqual([
      { code: 'duplicateValidFrom', validFrom: '2026-03-12', ids: ['rate-002', 'rate-003'] },
    ]);
  });

  it('flags a cost that is not above zero (parsed records can’t be, so forge one)', () => {
    const forged = { ...okafor[0], hourlyCost: 0 } as RateRecord;
    expect(checkRateHistory([forged])).toEqual([{ code: 'nonPositiveRate', id: 'rate-001', hourlyCost: 0 }]);
    expect(checkRateHistory([{ ...forged, hourlyCost: Number.NaN }])).toHaveLength(1);
  });
});

describe('addRate', () => {
  it('inserts a record anywhere in the history, including retroactively', () => {
    const added = expectOk(addRate(okafor, rate('rate-003', '2024-06-01', 70)));
    expect(added.map((r) => r.validFrom)).toEqual(['2024-06-01', '2025-01-01', '2026-03-12']);
    const between = expectOk(addRate(okafor, rate('rate-004', '2025-09-01', 85)));
    expect(between.map((r) => r.hourlyCost)).toEqual([80, 85, 95]);
  });

  it('refuses a second record on the same day, and a reused id', () => {
    expect(addRate(okafor, rate('rate-003', '2025-01-01', 90))).toMatchObject({
      ok: false,
      error: { code: 'duplicateValidFrom' },
    });
    expect(addRate(okafor, rate('rate-001', '2027-01-01', 90))).toEqual({
      ok: false,
      error: { code: 'duplicateId', id: 'rate-001' },
    });
  });

  it('refuses a cost that is not above zero', () => {
    const forged = { ...rate('rate-003', '2027-01-01', 1), hourlyCost: -5 };
    expect(addRate(okafor, forged)).toMatchObject({ ok: false, error: { code: 'nonPositiveRate' } });
  });

  it('does not mutate the history it is given', () => {
    const copy = structuredClone(okafor);
    addRate(okafor, rate('rate-003', '2024-06-01', 70));
    expect(okafor).toEqual(copy);
  });
});

describe('correctRate', () => {
  it('changes the cost or the start day', () => {
    expect(expectOk(correctRate(okafor, id('rate-002'), { hourlyCost: 97.5 }))[1]?.hourlyCost).toBe(97.5);
    const moved = expectOk(correctRate(okafor, id('rate-002'), { validFrom: IsoDate.parse('2024-01-01') }));
    expect(moved.map((r) => r.id)).toEqual(['rate-002', 'rate-001']);
  });

  it('may keep a record on its own day, and refuses another record’s day', () => {
    expect(correctRate(okafor, id('rate-002'), { validFrom: IsoDate.parse('2026-03-12'), hourlyCost: 96 }).ok).toBe(
      true,
    );
    expect(correctRate(okafor, id('rate-002'), { validFrom: IsoDate.parse('2025-01-01') })).toMatchObject({
      ok: false,
      error: { code: 'duplicateValidFrom' },
    });
  });

  it('keeps a field whose patch value is undefined', () => {
    const before = okafor.find((r) => r.id === id('rate-002'));
    // A caller without exactOptionalPropertyTypes can pass explicit undefined.
    const patch = { validFrom: undefined, hourlyCost: undefined } as unknown as Parameters<typeof correctRate>[2];
    const after = expectOk(correctRate(okafor, id('rate-002'), patch)).find((r) => r.id === id('rate-002'));
    expect(after).toEqual(before);
  });

  it('refuses an unknown record', () => {
    expect(correctRate(okafor, id('rate-404'), { hourlyCost: 1 })).toEqual({
      ok: false,
      error: { code: 'notFound', id: 'rate-404' },
    });
  });
});

describe('removeRate', () => {
  it('removes any record, the first and the last included', () => {
    expect(expectOk(removeRate(okafor, id('rate-001'))).map((r) => r.id)).toEqual(['rate-002']);
    expect(expectOk(removeRate(okafor, id('rate-002'))).map((r) => r.id)).toEqual(['rate-001']);
  });

  it('allows an empty history', () => {
    expect(expectOk(removeRate([okafor[0] as RateRecord], id('rate-001')))).toEqual([]);
  });

  it('refuses an unknown record', () => {
    expect(removeRate(okafor, id('rate-404'))).toEqual({ ok: false, error: { code: 'notFound', id: 'rate-404' } });
  });
});

describe('rate history properties', () => {
  const day = fc
    .integer({ min: 0, max: 2000 })
    .map((offset) => IsoDate.parse(new Date(Date.UTC(2022, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10)));
  const cost = fc.integer({ min: 100, max: 50_000 }).map((cents) => cents / 100);
  const records = fc
    .uniqueArray(day, { maxLength: 6 })
    .chain((days) =>
      fc.tuple(
        ...days.map((validFrom, index) =>
          cost.map((hourlyCost) => rate(`rate-${String(index + 1).padStart(3, '0')}`, validFrom, hourlyCost)),
        ),
      ),
    );

  it('keeps every successful edit valid and sorted, and add then remove restores the history', () => {
    fc.assert(
      fc.property(records, day, cost, (history, validFrom, hourlyCost) => {
        const draft = rate('rate-999', validFrom, hourlyCost);
        const added = addRate(history, draft);
        const taken = history.some((r) => r.validFrom === validFrom);
        expect(added.ok).toBe(!taken);
        if (!added.ok) return;
        expect(checkRateHistory(added.value)).toEqual([]);
        expect(added.value.map((r) => r.validFrom)).toEqual([...added.value.map((r) => r.validFrom)].sort());
        expect(expectOk(removeRate(added.value, draft.id))).toEqual(
          historyOf(history, history[0]?.employeeId ?? draft.employeeId),
        );
      }),
      { numRuns: Number(process.env.FC_RUNS ?? 200) },
    );
  });

  it('makes new ids that parse', () => {
    expect(RateRecordId.safeParse(newRateRecordId()).success).toBe(true);
    expect(newRateRecordId(() => '00000000-0000-4000-8000-000000000001')).toBe(
      'rate-00000000-0000-4000-8000-000000000001',
    );
  });
});

describe('rateOn', () => {
  const day = (value: string) => IsoDate.parse(value);

  it('is the record that started most recently on or before the day', () => {
    expect(rateOn(okafor, day('2026-10-07'))?.id).toBe('rate-002');
    expect(rateOn(okafor, day('2026-03-11'))?.id).toBe('rate-001');
  });

  it('prices a record’s own first day at its cost', () => {
    expect(rateOn(okafor, day('2026-03-12'))?.hourlyCost).toBe(95);
    expect(rateOn(okafor, day('2025-01-01'))?.hourlyCost).toBe(80);
  });

  it('is none before the first rate and with no rates', () => {
    expect(rateOn(okafor, day('2024-12-31'))).toBeNull();
    expect(rateOn([], day('2026-10-07'))).toBeNull();
  });

  it('does not depend on the order of the records', () => {
    expect(rateOn([...okafor].reverse(), day('2026-10-07'))?.id).toBe('rate-002');
    expect(rateOn([...okafor].reverse(), day('2025-06-01'))?.id).toBe('rate-001');
  });

  it('ignores records that start after the day, even when they come first', () => {
    const future = rate('rate-003', '2027-01-01', 120);
    expect(rateOn([future, ...okafor], day('2026-10-07'))?.id).toBe('rate-002');
  });
});
