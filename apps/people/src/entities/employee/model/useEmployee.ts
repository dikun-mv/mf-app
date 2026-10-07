import type { Employee, EmployeeId } from '@baseline/people-contract';
import { useEmployees } from './useEmployees';

/** One employee, or `undefined` when there is none with that id (the page then says so, screens 2.7). */
export function useEmployee(id: EmployeeId): Employee | undefined {
  return useEmployees().find((employee) => employee.id === id);
}
