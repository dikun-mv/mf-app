import type { Employee } from '@baseline/people-contract';
import { useSuspenseQuery } from '@tanstack/react-query';
import { employeesQuery, useRepository } from '../../../shared/api';

/** Every employee (D26). People's own data suspends: the page above has the loading and failed states (D32). */
export function useEmployees(): readonly Employee[] {
  return useSuspenseQuery(employeesQuery(useRepository())).data;
}
