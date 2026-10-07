import type { BreakdownItem } from '@baseline/delivery-contract';
import { useSuspenseQuery } from '@tanstack/react-query';
import { collectionQuery, useRepository } from '../../../shared/api';

/** Every work breakdown item of every project, in the order they were created. Suspends until loaded (D32). */
export function useBreakdownItems(): readonly BreakdownItem[] {
  return useSuspenseQuery(collectionQuery(useRepository(), 'breakdownItems')).data;
}
