import type { Allocation, Project } from '@baseline/delivery-contract';
import type { GridNode } from '../grid';
import { buildGrid, projectMonths } from '../projectGrid';
import { type EmployeeMonth, valueInUnit } from '../pricing';
import { type DisplayUnit, personMonths } from '../units';
import { seedAllocations, seedEmployees, seedItems, seedProjects, seedRateRecords } from './seed';

// The seed laid out as the grid each project shows, for tests.

const employeesById = new Map(seedEmployees.map((employee) => [employee.id, employee]));

export function employeeMonthOf(allocation: Allocation): EmployeeMonth {
  const employee = employeesById.get(allocation.employeeId);
  if (employee === undefined) throw new Error(`No seed employee ${allocation.employeeId}`);
  return {
    weeklyHours: employee.weeklyHours,
    month: allocation.month,
    rates: seedRateRecords.filter((record) => record.employeeId === employee.id),
  };
}

export function seedGrid(
  project: Project,
  unit: DisplayUnit,
  perEur = 1,
  factorOf: (allocation: Allocation) => number = () => 1,
): { roots: GridNode[]; monthCount: number } {
  const months = projectMonths(project);
  const roots = buildGrid(project, seedItems, seedAllocations, months, (allocation) =>
    valueInUnit(unit, personMonths(allocation.amount * factorOf(allocation)), employeeMonthOf(allocation), perEur),
  );
  return { roots, monthCount: months.length };
}

export { seedProjects };
