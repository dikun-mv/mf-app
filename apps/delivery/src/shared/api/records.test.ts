import { describe, expect, it } from '@rstest/core';
import { asPocketBase } from '../testing';
import { AllocationRecord, BreakdownItemRecord, ProjectRecord, RECORD_SCHEMAS } from './records';

describe('Delivery’s record schemas', () => {
  it('parse a project and drop what PocketBase adds', () => {
    const project = { id: 'prj-1', name: 'Ledger Consolidation', startDate: '2026-03-01', endDate: '2027-02-28' };
    expect(ProjectRecord.parse(asPocketBase('projects', project))).toEqual(project);
  });

  it('read a root’s empty parent as null and keep a parent id', () => {
    const root = { id: 'wbs-001', projectId: 'prj-1', parentId: '', name: 'Ledger migration' };
    expect(BreakdownItemRecord.parse(asPocketBase('breakdown_items', root))).toEqual({ ...root, parentId: null });
    const child = { id: 'wbs-002', projectId: 'prj-1', parentId: 'wbs-001', name: 'Discovery' };
    expect(BreakdownItemRecord.parse(asPocketBase('breakdown_items', child))).toEqual(child);
  });

  it('parse an allocation', () => {
    const allocation = {
      id: 'alloc-001',
      breakdownItemId: 'wbs-012',
      employeeId: 'emp-001',
      month: '2026-03',
      amount: 0.5,
      editedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(AllocationRecord.parse(asPocketBase('allocations', allocation))).toEqual(allocation);
  });

  it('refuse a record of another collection, a malformed id and a negative amount', () => {
    const project = { id: 'prj-1', name: 'Ledger', startDate: '2026-03-01', endDate: '2027-02-28' };
    expect(ProjectRecord.safeParse(asPocketBase('allocations', project)).success).toBe(false);
    expect(ProjectRecord.safeParse(asPocketBase('projects', { ...project, id: 'wbs-1' })).success).toBe(false);
    const allocation = {
      id: 'alloc-001',
      breakdownItemId: 'wbs-012',
      employeeId: 'emp-001',
      month: '2026-03',
      amount: -1,
      editedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(AllocationRecord.safeParse(asPocketBase('allocations', allocation)).success).toBe(false);
  });

  it('refuse a parent that is neither empty nor an item id', () => {
    const item = { id: 'wbs-002', projectId: 'prj-1', parentId: 'prj-1', name: 'Discovery' };
    expect(BreakdownItemRecord.safeParse(asPocketBase('breakdown_items', item)).success).toBe(false);
  });
});

describe('RECORD_SCHEMAS', () => {
  it('parse People’s records with the contract’s own schemas', () => {
    const employee = { id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 };
    expect(RECORD_SCHEMAS.employees.parse(asPocketBase('employees', employee))).toEqual(employee);
    const rate = { id: 'rate-002', employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 };
    expect(RECORD_SCHEMAS.rateRecords.parse(asPocketBase('rate_records', rate))).toEqual(rate);
  });
});
