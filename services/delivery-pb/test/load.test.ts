import { Allocation } from '@baseline/delivery-contract';
import { loadsOf } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import fc from 'fast-check';
import { loadOf, type Contribution } from '../pb_hooks/lib/load.js';

// The property that keeps load.js honest (D8, D18, T3.9): for one (employee, month), loadOf gives the
// numbers, the flag and the causer that delivery-domain's loadsOf gives. The arbitraries are written here
// on purpose, and draw ids and timestamps from small pools, so ties in `editedAt` are common.

const EMPLOYEE = 'emp-001';
const MONTH = '2026-03';

const ID_POOL = ['alloc-001', 'alloc-002', 'alloc-003', 'alloc-010', 'alloc-020', 'alloc-100'] as const;
const EDITED_AT_POOL = ['2026-01-01T00:00:00.000Z', '2026-02-01T10:30:00.000Z', '2026-02-01T10:30:00.001Z'] as const;
const SEEDED_AT = EDITED_AT_POOL[0];

/** Amounts around the threshold: tenths sum with float error (0.1 + 0.2 + 0.7), and 0 is a non-contributor. */
const amountArb = fc.oneof(
  fc.integer({ min: 0, max: 15 }).map((tenths) => tenths / 10),
  fc.constantFrom(0.25, 0.75, 1e-10),
  fc.double({ min: 0, max: 1.5, noNaN: true }),
);

/** The allocations of one pair: ids are unique within it, as the database guarantees. */
const pairArb = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom(...ID_POOL),
    amount: amountArb,
    editedAt: fc.constantFrom(...EDITED_AT_POOL),
  }),
  { selector: (allocation) => allocation.id, maxLength: ID_POOL.length },
);

/** The same allocations as delivery-domain entities, each on its own leaf. */
const toDomain = (contributions: readonly Contribution[]): Allocation[] =>
  contributions.map(({ id, amount, editedAt }, index) =>
    Allocation.parse({
      id,
      breakdownItemId: `wbs-${String(index + 1).padStart(3, '0')}`,
      employeeId: EMPLOYEE,
      month: MONTH,
      amount,
      editedAt,
    }),
  );

describe('loadOf', () => {
  it('matches delivery-domain loadsOf for one pair', () => {
    fc.assert(
      fc.property(pairArb, (contributions) => {
        const [expected, ...rest] = loadsOf(toDomain(contributions));
        expect(rest).toEqual([]);
        expect(loadOf(contributions)).toEqual(
          expected === undefined
            ? null
            : {
                allocatedPersonMonths: expected.allocatedPersonMonths,
                overCapacity: expected.overCapacity,
                // PocketBase has no null: "" where the domain says null.
                causingAllocationId: expected.causingAllocationId ?? '',
              },
        );
      }),
      { numRuns: 1000 },
    );
  });

  it('breaks a tie in editedAt with the highest id (the seed rows)', () => {
    expect(
      loadOf([
        { id: 'alloc-050', amount: 0.6, editedAt: SEEDED_AT },
        { id: 'alloc-073', amount: 0.6, editedAt: SEEDED_AT },
      ]),
    ).toEqual({ allocatedPersonMonths: 1.2, overCapacity: true, causingAllocationId: 'alloc-073' });
  });

  it('is null with no effort', () => {
    expect(loadOf([])).toBeNull();
    expect(loadOf([{ id: 'alloc-001', amount: 0, editedAt: SEEDED_AT }])).toBeNull();
  });
});
