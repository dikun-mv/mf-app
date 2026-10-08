import { describe, expect, it } from '@rstest/core';
import { ProjectId } from '@baseline/delivery-contract';
import { EmployeeId } from '@baseline/people-contract';
import { projectProblems } from './planProblems';
import { seedEmployees, seedPlan } from './testing/seed';
import { allocation, item, plan, project } from './testing/stateBuilders';

const PRJ_1 = ProjectId.parse('prj-1');
const PRJ_2 = ProjectId.parse('prj-2');

describe('projectProblems', () => {
  it('finds nothing in any seed project', () => {
    const known = new Set(seedEmployees.map((employee) => employee.id));
    const seed = seedPlan();
    for (const { id } of seed.projects) expect(projectProblems(seed, id, known)).toEqual([]);
  });

  it('describes each broken rule of the open project in words, naming items by name', () => {
    const bad = plan({
      projects: [project('prj-1', '2026-03-01', '2026-06-30')],
      items: [
        item('wbs-1', 'prj-1', null, 'Build'),
        item('wbs-11', 'prj-1', 'wbs-1', 'API'),
        item('wbs-111', 'prj-1', 'wbs-11', 'Auth'),
        item('wbs-1111', 'prj-1', 'wbs-111', 'Tokens'),
        item('wbs-9', 'prj-1', 'wbs-99', 'Stray'),
      ],
      allocations: [
        allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.5),
        allocation('alloc-2', 'wbs-1111', 'emp-001', '2027-01', 0.5),
        allocation('alloc-3', 'wbs-1111', 'emp-999', '2026-04', 0.5),
        allocation('alloc-4', 'wbs-1111', 'emp-999', '2026-04', 0.2),
      ],
    });
    expect(projectProblems(bad, PRJ_1, new Set([EmployeeId.parse('emp-001')]))).toEqual([
      '“Tokens” is at level 4; the tree has at most three.',
      "“Stray” is under an item that doesn't exist (wbs-99), so it isn't shown.",
      'Allocation alloc-1 is on “Build”, which has children; allocations belong on leaves.',
      "Allocation alloc-2 is for 2027-01, outside the project's months, so it isn't shown.",
      "Allocation alloc-3 is for emp-999, who isn't in People's register.",
      "Allocation alloc-4 is for emp-999, who isn't in People's register.",
      'Allocations alloc-3, alloc-4 are for the same person, item and month.',
    ]);
  });

  it('skips the unknown-employee check without People’s register', () => {
    const bad = plan({
      projects: [project('prj-1')],
      items: [item('wbs-1', 'prj-1', null)],
      allocations: [allocation('alloc-1', 'wbs-1', 'emp-999', '2026-03', 0.5)],
    });
    expect(projectProblems(bad, PRJ_1)).toEqual([]);
    expect(projectProblems(bad, PRJ_1, new Set())).toHaveLength(1);
  });

  it('reports only what belongs to the open project', () => {
    const bad = plan({
      projects: [project('prj-1'), project('prj-2')],
      items: [
        item('wbs-1', 'prj-1', null, 'One'),
        item('wbs-2', 'prj-2', 'wbs-1', 'Two'),
        item('wbs-3', 'prj-9', null, 'Lost'),
      ],
      allocations: [allocation('alloc-1', 'wbs-99', 'emp-001', '2026-03', 0.5)],
    });
    expect(projectProblems(bad, PRJ_1)).toEqual([]);
    expect(projectProblems(bad, PRJ_2)).toEqual(['“Two” is under “One”, an item of another project.']);
  });

  it('reports a cycle and ids used twice', () => {
    const bad = plan({
      projects: [project('prj-1')],
      items: [
        item('wbs-1', 'prj-1', 'wbs-2', 'A'),
        item('wbs-2', 'prj-1', 'wbs-1', 'B'),
        item('wbs-3', 'prj-1', null),
        item('wbs-3', 'prj-1', null),
      ],
      allocations: [
        allocation('alloc-1', 'wbs-3', 'emp-001', '2026-03', 0.5),
        allocation('alloc-1', 'wbs-3', 'emp-002', '2026-03', 0.5),
      ],
    });
    expect(projectProblems(bad, PRJ_1)).toEqual([
      'Two items share the id wbs-3.',
      'Two allocations share the id alloc-1.',
      "“A” is in a loop of items that are each other's parents, so it isn't shown.",
      "“B” is in a loop of items that are each other's parents, so it isn't shown.",
    ]);
  });
});
