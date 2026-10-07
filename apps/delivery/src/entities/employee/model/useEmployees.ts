import { useQuery } from '@tanstack/react-query';
import { collectionQuery, useRepository } from '../../../shared/api';

/**
 * People's employees. They are the other team's data, so this never suspends or throws (D32): the result
 * is pending, failed or loaded, and the widget shows employee ids while it isn't loaded.
 */
export function useEmployees() {
  return useQuery(collectionQuery(useRepository(), 'employees'));
}
