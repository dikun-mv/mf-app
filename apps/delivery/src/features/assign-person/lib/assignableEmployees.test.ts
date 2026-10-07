import { BreakdownItemId } from '@baseline/delivery-contract';
import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { allocation, employee } from '../../../shared/testing';
import { assignableEmployees, describeEmployee } from './assignableEmployees';

const LEAF = BreakdownItemId.parse('wbs-1');
const employees = [employee('emp-1', 'Zoe Adler'), employee('emp-2', 'Ana Berg'), employee('emp-3', 'Milo Cruz')];

describe('assignableEmployees', () => {
  it('leaves out who already has an allocation on the leaf, and lists the rest by name', () => {
    const allocations = [allocation('alloc-1', 'wbs-1', 'emp-3', '2026-03', 0.5)];
    expect(assignableEmployees(employees, allocations, LEAF, []).map((e) => e.name)).toEqual(['Ana Berg', 'Zoe Adler']);
  });

  it('keeps someone who is only on another leaf', () => {
    const allocations = [allocation('alloc-1', 'wbs-2', 'emp-3', '2026-03', 0.5)];
    expect(assignableEmployees(employees, allocations, LEAF, [])).toHaveLength(3);
  });

  it('leaves out who was assigned in this page and has no value yet', () => {
    const names = assignableEmployees(employees, [], LEAF, [EmployeeId.parse('emp-2')]).map((e) => e.name);
    expect(names).toEqual(['Milo Cruz', 'Zoe Adler']);
  });
});

describe('describeEmployee', () => {
  it('gives the role and weekly hours', () => {
    expect(describeEmployee(employee('emp-1', 'Henrik Bauer', 'QA Engineer', 20))).toBe(
      'Henrik Bauer — QA Engineer, 20 h/week',
    );
  });
});
