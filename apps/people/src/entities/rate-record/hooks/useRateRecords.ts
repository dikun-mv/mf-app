import type { RateRecord } from '@baseline/people-contract';
import { useSuspenseQuery } from '@tanstack/react-query';
import { rateRecordsQuery, useRepository } from '../../../shared/api';

/** Every rate record of every employee (D26): the register reads today's rate from them, the detail view the history. */
export function useRateRecords(): readonly RateRecord[] {
  return useSuspenseQuery(rateRecordsQuery(useRepository())).data;
}
