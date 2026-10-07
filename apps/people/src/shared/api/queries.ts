import { queryOptions } from '@tanstack/react-query';
import { employeeKeys, employeeMonthLoadKeys, rateRecordKeys } from './queryKeys';
import type { PeopleRepository } from './repository';

// The query of each collection: the whole collection, parsed (D26). Hooks in `entities` run them with
// `useSuspenseQuery` (People's own data) or `useQuery` (the Delivery feed, which never suspends, D32).

export const employeesQuery = (repository: PeopleRepository) =>
  queryOptions({ queryKey: employeeKeys.all, queryFn: () => repository.listEmployees() });

export const rateRecordsQuery = (repository: PeopleRepository) =>
  queryOptions({ queryKey: rateRecordKeys.all, queryFn: () => repository.listRateRecords() });

export const employeeMonthLoadsQuery = (repository: PeopleRepository) =>
  queryOptions({ queryKey: employeeMonthLoadKeys.all, queryFn: () => repository.listEmployeeMonthLoads() });
