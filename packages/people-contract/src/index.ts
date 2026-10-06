import { IsoDate, entityId } from '@baseline/host-contract';
import { z } from 'zod';

// People's published types (T1.1). T3.1 adds the REST paths, events and the conformance fixture.

export const EmployeeId = entityId('emp', 'EmployeeId');
export type EmployeeId = z.infer<typeof EmployeeId>;

export const RateRecordId = entityId('rate', 'RateRecordId');
export type RateRecordId = z.infer<typeof RateRecordId>;

/** Contracted hours per week. A const tuple, so adding an option is one edit. */
export const WEEKLY_HOURS = [40, 32, 20] as const;
export const WeeklyHours = z.literal(WEEKLY_HOURS);
export type WeeklyHours = z.infer<typeof WeeklyHours>;

export const Employee = z.object({
  id: EmployeeId,
  name: z.string().min(1),
  role: z.string().min(1),
  weeklyHours: WeeklyHours,
});
export type Employee = z.infer<typeof Employee>;

/**
 * A cost rate in EUR per hour. There is no end date: it applies from `validFrom` (inclusive)
 * until the employee's next record begins, and the last record is open-ended.
 */
export const RateRecord = z.object({
  id: RateRecordId,
  employeeId: EmployeeId,
  validFrom: IsoDate,
  hourlyCost: z.number().positive(),
});
export type RateRecord = z.infer<typeof RateRecord>;
