import type { Allocation } from '@baseline/delivery-contract';
import { useSuspenseQuery } from '@tanstack/react-query';
import { collectionQuery, useRepository } from '../../../shared/api';

/** Every allocation of every project. Suspends until loaded (D32). */
export function useAllocations(): readonly Allocation[] {
  return useSuspenseQuery(collectionQuery(useRepository(), 'allocations')).data;
}
