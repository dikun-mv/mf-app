import type { Employee } from '@baseline/people-contract';
import { PageHeader } from '@baseline/ui';
import { CapacityBadge, overCapacityCountLabel, useCapacity, type Capacity } from '../../../entities/capacity';
import { BackToRegister } from '../../../shared/ui';
import styles from './EmployeeProfile.module.css';
import { OverCapacityNotice } from './OverCapacityNotice';

/** The badge at the end of the title row: within, over (with how many months), or unknown (screens 2.3, 2.6). */
function CapacityAside({ capacity, employee }: { capacity: Capacity; employee: Employee }) {
  if (capacity.status === 'loading') return null;
  if (capacity.status === 'unknown') return <span className={styles.unknown}>Capacity unknown</span>;
  const own = capacity.of(employee.id);
  return own.status === 'over' ? (
    <CapacityBadge tone="over">{overCapacityCountLabel(own.months)}</CapacityBadge>
  ) : (
    <CapacityBadge tone="within">Within capacity</CapacityBadge>
  );
}

/**
 * The top of an employee's page (screens 2.3, 2.6): the way back to the register, the name, and the role,
 * weekly hours and id under it, with the employee's capacity at the far end and, when some months are over
 * it, which months and by how much. Capacity is Delivery's data and optional (D32): without it the page
 * says it is unknown and the rest works.
 */
export function EmployeeProfile({ employee }: { employee: Employee }) {
  const capacity = useCapacity();
  const own = capacity.status === 'known' ? capacity.of(employee.id) : null;
  return (
    <>
      <PageHeader
        back={<BackToRegister />}
        title={employee.name}
        subtitle={`${employee.role} · ${String(employee.weeklyHours)} h/week · ${employee.id}`}
        aside={<CapacityAside capacity={capacity} employee={employee} />}
      />
      {own?.status === 'over' ? <OverCapacityNotice months={own.months} className={styles.notice} /> : null}
    </>
  );
}
