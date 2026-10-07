import { useEmployees } from '../../../entities/employee';
import { useRateRecords } from '../../../entities/rate-record';
import { useConnectionStatus } from '../../../shared/api';

/**
 * Whether People's data is out of reach: not loaded, and either a read of it failed or its realtime
 * connection is down (T6.13, D32). A first load that is merely slow is not this. Once it has loaded it is
 * not this either, even if the connection drops later: the cached employees and rates still stand.
 *
 * It reads the same queries as the grid, so it clears by itself: when People's realtime reconnects, the
 * instance's queries that have no data are fetched again (D29), and the first one that succeeds ends this.
 */
export function usePeopleUnreachable(): boolean {
  const employees = useEmployees();
  const rates = useRateRecords();
  const connection = useConnectionStatus('people');
  const missing = employees.data === undefined || rates.data === undefined;
  return missing && (employees.isError || rates.isError || connection === 'down');
}
