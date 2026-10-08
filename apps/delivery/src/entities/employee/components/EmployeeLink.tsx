import type { EmployeeId } from '@baseline/people-contract';
import { useHostLink } from '../../../shared/lib';

export interface EmployeeLinkProps {
  employeeId: EmployeeId;
  /** What the link says: the employee's name, or their id while People's data isn't there (D32). */
  label: string;
  className?: string;
}

/**
 * A link to the employee's page in People. It is a real `<a href>`, so open-in-new-tab and copy-link
 * work; a plain click goes through the host's `navigate` (D22), so the shell switches app without a reload.
 * It reads the host context itself, so the rows that hold it keep their props.
 */
export function EmployeeLink({ employeeId, label, className }: EmployeeLinkProps) {
  const link = useHostLink(`/people/${employeeId}`);
  return (
    <a {...link} className={className}>
      {label}
    </a>
  );
}
