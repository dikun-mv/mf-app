import type { Instance } from './repository';

// One query per collection (D26), each keyed by a factory. The first element is the PocketBase instance,
// so one `invalidateQueries({ queryKey: instanceKey('delivery') })` refetches everything read from it
// after a reconnect (D29). TanStack's query-key lint rules aren't among Rslint's plugins (D24); these
// factories are the only place a key is written.

export const employeeKeys = { all: ['people', 'employees'] as const };
export const rateRecordKeys = { all: ['people', 'rate-records'] as const };
export const employeeMonthLoadKeys = { all: ['delivery', 'employee-month-loads'] as const };

/** Every query read from one PocketBase instance. */
export const instanceKey = (instance: Instance) => [instance] as const;
