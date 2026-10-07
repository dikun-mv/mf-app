import { describe, expect, it } from '@rstest/core';
import { project } from '../../../shared/testing';
import { projectMonths } from './projectMonths';

describe('projectMonths', () => {
  it.each([
    ['Ledger Consolidation', '2026-03-01', '2027-02-28', 12],
    ['Reporting Platform', '2026-04-01', '2027-03-31', 12],
    ['Client Portal Rebuild', '2026-06-01', '2027-03-31', 10],
    ['Warehouse Data Migration', '2026-04-01', '2026-12-31', 9],
  ])('counts the months of %s', (_name, startDate, endDate, months) => {
    expect(projectMonths(project('prj-1', 'Any', startDate, endDate))).toHaveLength(months);
  });

  it('lists them first to last', () => {
    expect(projectMonths(project('prj-1', 'Any', '2026-11-15', '2027-02-03'))).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });
});
