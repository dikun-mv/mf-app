import { describe, expect, it } from '@rstest/core';
import { EmployeeId } from '@baseline/people-contract';
import { checkInvariants } from './invariants';
import { seedEmployees, seedPlan } from './testing/seed';
import { allocation, item, plan, project } from './testing/stateBuilders';

describe('checkInvariants', () => {
  it('finds nothing wrong with the seed, including unknown employees', () => {
    const known = new Set(seedEmployees.map((employee) => employee.id));
    expect(checkInvariants(seedPlan(), known)).toEqual([]);
  });

  it('matches the seed’s counts from the brief', () => {
    const seed = seedPlan();
    expect([seedEmployees.length, seed.projects.length, seed.items.length, seed.allocations.length]).toEqual([
      60, 4, 90, 720,
    ]);
  });

  const good = plan({
    projects: [project('prj-1', '2026-03-01', '2026-06-30')],
    items: [item('wbs-1', 'prj-1', null), item('wbs-11', 'prj-1', 'wbs-1')],
    allocations: [allocation('alloc-1', 'wbs-11', 'emp-001', '2026-03', 0.5)],
  });

  it('reports the same id used twice', () => {
    const bad = plan({
      projects: [project('prj-1'), project('prj-1')],
      items: [item('wbs-1', 'prj-1', null), item('wbs-1', 'prj-1', null)],
      allocations: [
        allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.5),
        allocation('alloc-1', 'wbs-1', 'emp-002', '2026-03', 0.5),
      ],
    });
    expect(checkInvariants(bad).filter((v) => v.kind === 'duplicateId')).toEqual([
      { kind: 'duplicateId', entity: 'project', id: 'prj-1' },
      { kind: 'duplicateId', entity: 'breakdownItem', id: 'wbs-1' },
      { kind: 'duplicateId', entity: 'allocation', id: 'alloc-1' },
    ]);
  });

  it('reports an allocation on a non-leaf or on a missing item', () => {
    const bad = plan({
      ...good,
      allocations: [
        allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.5),
        allocation('alloc-2', 'wbs-404', 'emp-001', '2026-03', 0.5),
      ],
    });
    expect(checkInvariants(bad)).toEqual([
      { kind: 'allocationOnNonLeaf', allocationId: 'alloc-1', itemId: 'wbs-1' },
      { kind: 'allocationOnMissingItem', allocationId: 'alloc-2', itemId: 'wbs-404' },
    ]);
  });

  it('reports unknown employees only when a register is given', () => {
    const known = new Set([EmployeeId.parse('emp-002')]);
    expect(checkInvariants(good)).toEqual([]);
    expect(checkInvariants(good, known)).toEqual([
      { kind: 'unknownEmployee', allocationId: 'alloc-1', employeeId: 'emp-001' },
    ]);
  });

  it('reports a missing parent, a parent in another project and a missing project', () => {
    const bad = plan({
      projects: [project('prj-1'), project('prj-2')],
      items: [
        item('wbs-1', 'prj-1', 'wbs-404'),
        item('wbs-2', 'prj-2', null),
        item('wbs-3', 'prj-1', 'wbs-2'),
        item('wbs-4', 'prj-9', null),
      ],
    });
    expect(checkInvariants(bad)).toEqual([
      { kind: 'missingParent', itemId: 'wbs-1', parentId: 'wbs-404' },
      { kind: 'parentInOtherProject', itemId: 'wbs-3', parentId: 'wbs-2' },
      { kind: 'itemInMissingProject', itemId: 'wbs-4', projectId: 'prj-9' },
    ]);
  });

  it('reports a cycle and a tree deeper than three levels', () => {
    const cyclic = plan({
      projects: [project('prj-1')],
      items: [item('wbs-1', 'prj-1', 'wbs-2'), item('wbs-2', 'prj-1', 'wbs-1')],
    });
    expect(checkInvariants(cyclic).map((v) => v.kind)).toEqual(['cycle', 'cycle']);

    const deep = plan({
      projects: [project('prj-1')],
      items: [
        item('wbs-1', 'prj-1', null),
        item('wbs-2', 'prj-1', 'wbs-1'),
        item('wbs-3', 'prj-1', 'wbs-2'),
        item('wbs-4', 'prj-1', 'wbs-3'),
      ],
    });
    expect(checkInvariants(deep)).toEqual([{ kind: 'tooDeep', itemId: 'wbs-4', depth: 4 }]);
  });

  it('reports a month outside the project, duplicate cells and duplicate ids', () => {
    const bad = plan({
      ...good,
      allocations: [
        allocation('alloc-1', 'wbs-11', 'emp-001', '2026-03', 0.5),
        allocation('alloc-2', 'wbs-11', 'emp-001', '2026-03', 0.1),
        allocation('alloc-3', 'wbs-11', 'emp-001', '2027-01', 0.1),
        allocation('alloc-3', 'wbs-11', 'emp-002', '2026-04', 0.1),
      ],
    });
    const kinds = checkInvariants(bad).map((v) => v.kind);
    expect(kinds).toContain('allocationOutsideProject');
    expect(kinds).toContain('duplicateAllocationKey');
    expect(kinds).toContain('duplicateId');
  });
});
