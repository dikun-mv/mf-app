// Conformance fixture for the effective-dating rule (D7, T3.1). Delivery prices a plan from People's rate
// records itself, so the rule has two implementations in two teams. This is the one example both must agree
// on: the data People publishes, and what any reader must compute from it. It is plain data, so a reader
// parses it with its own schemas (`RateRecord.array().parse(OKAFOR_RATE_RECORDS)`) and compares with the
// expected slices. Delivery's rates test feeds it to its month slicer.

/** A. Okafor (emp-001): 80 EUR/h from 2025-01-01, 95 EUR/h from 2026-03-12. The seed's first two rate records. */
export const OKAFOR_RATE_RECORDS = [
  { id: 'rate-001', employeeId: 'emp-001', validFrom: '2025-01-01', hourlyCost: 80 },
  { id: 'rate-002', employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 },
] as const;

/**
 * March 2026 split at the 12th, a Thursday. The record's own day is priced at the new rate, so there are
 * 8 working days at 80 (the 2nd to the 11th) and 14 at 95 (the 12th to the 31st). `toExclusive` is the
 * first day of the next stretch, and working days are Monday to Friday with no public holidays.
 */
export const OKAFOR_MARCH_2026_SLICES = [
  { from: '2026-03-01', toExclusive: '2026-03-12', workingDays: 8, hourlyCost: 80 },
  { from: '2026-03-12', toExclusive: '2026-04-01', workingDays: 14, hourlyCost: 95 },
] as const;
