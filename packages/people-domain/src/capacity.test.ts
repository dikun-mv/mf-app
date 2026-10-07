import { EmployeeId } from '@baseline/people-contract';
import { Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { WITHIN_CAPACITY, capacitySummary } from './capacity';

const load = (employeeId: string, month: string, allocatedPersonMonths: number, overCapacity: boolean) => ({
  employeeId: EmployeeId.parse(employeeId),
  month: Month.parse(month),
  allocatedPersonMonths,
  overCapacity,
});

describe('capacitySummary', () => {
  it('lists an employee’s months over capacity with percent and PM', () => {
    const summary = capacitySummary([load('emp-003', '2026-06', 1.18, true)]);
    expect(summary.get(EmployeeId.parse('emp-003'))).toEqual({
      status: 'over',
      months: [{ month: '2026-06', percent: 118, personMonths: 1.18 }],
    });
  });

  it('rounds the percent to one decimal, free of float noise', () => {
    // 1.18 × 100 is 118.00000000000001 in floating point.
    const percentOf = (personMonths: number) => {
      const entry = capacitySummary([load('emp-003', '2026-06', personMonths, true)]).get(EmployeeId.parse('emp-003'));
      return entry?.status === 'over' ? entry.months[0]?.percent : undefined;
    };
    expect(percentOf(1.18)).toBe(118);
    expect(percentOf(1.0346)).toBe(103.5);
    expect(percentOf(1.0004)).toBe(100);
  });

  it('says within capacity for an employee with only months at or under capacity', () => {
    const summary = capacitySummary([load('emp-001', '2026-03', 0.5, false), load('emp-001', '2026-04', 1, false)]);
    expect(summary.get(EmployeeId.parse('emp-001'))).toEqual({ status: 'within' });
    expect(summary.get(EmployeeId.parse('emp-001'))).toBe(WITHIN_CAPACITY);
  });

  it('keeps only the over months of an employee who has both, oldest first whatever the feed order', () => {
    const summary = capacitySummary([
      load('emp-002', '2026-09', 1.1, true),
      load('emp-002', '2026-03', 0.6, false),
      load('emp-002', '2026-05', 1.25, true),
    ]);
    expect(summary.get(EmployeeId.parse('emp-002'))).toEqual({
      status: 'over',
      months: [
        { month: '2026-05', percent: 125, personMonths: 1.25 },
        { month: '2026-09', percent: 110, personMonths: 1.1 },
      ],
    });
  });

  it('keeps employees apart and leaves out those with no row', () => {
    const summary = capacitySummary([
      load('emp-001', '2026-03', 0.5, false),
      load('emp-003', '2026-06', 1.18, true),
      load('emp-001', '2026-04', 0.4, false),
    ]);
    expect([...summary.keys()].sort()).toEqual(['emp-001', 'emp-003']);
    expect(summary.has(EmployeeId.parse('emp-999'))).toBe(false);
  });

  it('is empty for an empty feed', () => {
    expect(capacitySummary([]).size).toBe(0);
  });
});
