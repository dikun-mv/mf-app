import type { Employee } from '@baseline/people-contract';

/**
 * The employees whose name or role contains the query, ignoring case and surrounding spaces, in the
 * order given (screens 2.1). An empty or blank query matches everyone. The register keeps the term
 * in `?q=` (D31) and passes it as typed.
 */
export function searchEmployees<T extends Pick<Employee, 'name' | 'role'>>(
  employees: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...employees];
  return employees.filter(
    (employee) => employee.name.toLowerCase().includes(needle) || employee.role.toLowerCase().includes(needle),
  );
}
