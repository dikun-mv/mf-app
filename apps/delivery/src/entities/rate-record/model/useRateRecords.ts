import { useQuery } from '@tanstack/react-query';
import { collectionQuery, useRepository } from '../../../shared/api';

/** People's rate records. The other team's data, so it never suspends or throws (D32); see `useEmployees`. */
export function useRateRecords() {
  return useQuery(collectionQuery(useRepository(), 'rateRecords'));
}
