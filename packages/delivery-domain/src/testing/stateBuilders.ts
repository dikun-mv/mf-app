import { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import type { PlanState } from '../changeSet';
import { SEEDED_AT } from './seed';

// Small plan states for tests, written as the records they are.

export const project = (id: string, startDate = '2026-01-01', endDate = '2026-12-31') =>
  Project.parse({ id, name: `Project ${id}`, startDate, endDate });

export const item = (id: string, projectId: string, parentId: string | null, name = `Item ${id}`) =>
  BreakdownItem.parse({ id, projectId, parentId, name });

export const allocation = (
  id: string,
  breakdownItemId: string,
  employeeId: string,
  month: string,
  amount: number,
  editedAt: string = SEEDED_AT,
) => Allocation.parse({ id, breakdownItemId, employeeId, month, amount, editedAt });

export const plan = (parts: Partial<PlanState>): PlanState => ({
  projects: parts.projects ?? [],
  items: parts.items ?? [],
  allocations: parts.allocations ?? [],
});
