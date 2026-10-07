import type { Employee } from '@baseline/people-contract';
import { PageHeader } from '@baseline/ui';
import { BackToRegister } from '../../../shared/ui';

/**
 * The top of an employee's page (screens 2.3): the way back to the register, the name, and the role, weekly
 * hours and id under it.
 */
export function EmployeeProfile({ employee }: { employee: Employee }) {
  return (
    <PageHeader
      back={<BackToRegister />}
      title={employee.name}
      subtitle={`${employee.role} · ${String(employee.weeklyHours)} h/week · ${employee.id}`}
    />
  );
}
