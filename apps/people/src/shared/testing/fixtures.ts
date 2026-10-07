import { IsoDate } from '@baseline/host-contract';
import { Employee, RateRecord } from '@baseline/people-contract';

// A small register in the shape of the seed (docs/data.json): the two Okafors, a Brandt, and enough roles to
// search. Dates are fixed and far from today, so no test depends on the clock: a rate "in effect today" starts
// in the past, and `FUTURE` starts so far ahead it never is.

const person = (n: number, name: string, role: string, weeklyHours: 40 | 32 | 20): Employee =>
  Employee.parse({ id: `emp-${String(n).padStart(3, '0')}`, name, role, weeklyHours });

const rate = (n: number, employeeId: string, validFrom: string, hourlyCost: number): RateRecord =>
  RateRecord.parse({ id: `rate-${String(n)}`, employeeId, validFrom, hourlyCost });

export const ADAEZE_OKAFOR = person(1, 'Adaeze Okafor', 'Tech Lead', 40);

export const EMPLOYEES: readonly Employee[] = [
  ADAEZE_OKAFOR,
  person(2, 'Lena Okafor', 'Frontend Engineer', 40),
  person(3, 'Milan Brandt', 'Backend Engineer', 40),
  person(4, 'Samira Haddad', 'Frontend Engineer', 32),
  person(5, 'Tomas Novak', 'Frontend Engineer', 40),
  person(6, 'Priya Raman', 'Tech Lead', 20),
];

/** Starts in 2099: never in effect today. */
export const FUTURE = IsoDate.parse('2099-01-01');

export const ADAEZE_FIRST_RATE = rate(1, 'emp-001', '2025-01-01', 80);

export const ADAEZE_CURRENT_RATE = rate(2, 'emp-001', '2026-03-12', 95);

export const RATE_RECORDS: readonly RateRecord[] = [
  ADAEZE_FIRST_RATE,
  ADAEZE_CURRENT_RATE,
  rate(3, 'emp-001', FUTURE, 120),
  rate(4, 'emp-002', '2024-01-01', 85),
  rate(5, 'emp-003', '2024-01-01', 100),
  rate(6, 'emp-004', '2024-01-01', 106),
  // Tomas Novak has no rate yet, so nothing is in effect today.
  rate(7, 'emp-006', '2024-01-01', 90),
];
