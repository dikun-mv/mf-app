import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { GridRowView, GridValue, PersonRowView, SumRowView } from '@baseline/delivery-domain';
import type { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { visibleRows } from './visibleRows';

const value: GridValue = { exact: 0, steps: 0, text: '0.00' };
const sum = (key: string, parentKey: string | null, depth: number, kind: SumRowView['kind'] = 'node'): SumRowView => ({
  kind,
  key,
  parentKey,
  depth,
  label: key,
  itemId: kind === 'project' ? null : (key as BreakdownItemId),
  isLeaf: false,
  cells: [],
  total: value,
});
const person = (key: string, parentKey: string): PersonRowView => ({
  kind: 'person',
  key,
  parentKey,
  depth: 3,
  label: key,
  itemId: parentKey as BreakdownItemId,
  employeeId: key as EmployeeId,
  cells: [],
  total: value,
});

// project > a > (a1 > p1, p2), a2 ; b
const rows: GridRowView[] = [
  sum('project', null, 0, 'project'),
  sum('a', 'project', 1),
  sum('a1', 'a', 2),
  person('p1', 'a1'),
  person('p2', 'a1'),
  sum('a2', 'a', 2),
  sum('b', 'project', 1),
];
const keysOf = (collapsed: string[]) => visibleRows(rows, new Set(collapsed)).map(({ row }) => row.key);

describe('visibleRows', () => {
  it('shows every row when nothing is collapsed', () => {
    expect(keysOf([])).toEqual(['project', 'a', 'a1', 'p1', 'p2', 'a2', 'b']);
  });

  it('hides what is under a collapsed node but keeps the node', () => {
    expect(keysOf(['a1'])).toEqual(['project', 'a', 'a1', 'a2', 'b']);
    expect(keysOf(['a'])).toEqual(['project', 'a', 'b']);
  });

  it('hides a collapsed node’s collapsed descendants too, and brings them back as they were', () => {
    expect(keysOf(['a', 'a1'])).toEqual(['project', 'a', 'b']);
    const reopened = visibleRows(rows, new Set(['a1']));
    expect(reopened.find(({ row }) => row.key === 'a1')?.expanded).toBe(false);
  });

  it('marks the rows that have rows under them as expandable, except the project row', () => {
    const expandable = visibleRows(rows, new Set())
      .filter((entry) => entry.expandable)
      .map(({ row }) => row.key);
    expect(expandable).toEqual(['a', 'a1']);
  });

  it('never collapses the project row', () => {
    expect(keysOf(['project'])).toEqual(['project', 'a', 'a1', 'p1', 'p2', 'a2', 'b']);
  });
});
