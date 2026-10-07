import { DELIVERY_COLLECTIONS, EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { EmployeeRecord, PEOPLE_COLLECTIONS, RateRecordRecord, type RateRecord } from '@baseline/people-contract';
import type PocketBase from 'pocketbase';
import { z } from 'zod';
import { createDeliveryClient, createPeopleClient } from './clients';
import { toApiError, type ServiceName } from './errors';
import { parseRecords } from './parse';
import { subscribeToInstance, type Topic } from './realtime';
import type { Instance, PeopleRepository, RateChangeSet } from './repository';

// The SDK implementation of the repository (D30, T5.0a). Only `shared/api` imports `pocketbase`.

const TOPICS = {
  people: [
    { collection: 'employees', name: PEOPLE_COLLECTIONS.employees },
    { collection: 'rateRecords', name: PEOPLE_COLLECTIONS.rateRecords },
  ],
  delivery: [{ collection: 'employeeMonthLoads', name: DELIVERY_COLLECTIONS.employeeMonthLoads }],
} as const satisfies Record<Instance, readonly Topic[]>;

/** One item of a batch response: the status and the body of that operation (a delete's body is null). */
const BatchItem = z.object({ status: z.number(), body: z.unknown() });

/** Runs a request and maps an SDK failure to an `ApiError` of `service`. */
async function guarded<T>(service: ServiceName, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error, service);
  }
}

/**
 * Sends the change set as one batch: deletes first, then updates, then creates. A rate has no relation to
 * another rate, so only the unique index on `(employeeId, validFrom)` orders them: removing a rate and
 * adding one on the same day must delete first. Even a change set of one record goes through `createBatch`,
 * so every write takes the transactional path (ADR 033 c, ADR 035).
 */
async function sendRateChanges(pb: PocketBase, changes: RateChangeSet): Promise<RateRecord[]> {
  const batch = pb.createBatch();
  const rates = batch.collection(PEOPLE_COLLECTIONS.rateRecords);
  for (const id of changes.delete) rates.delete(id);
  for (const { id, ...fields } of changes.update) rates.update(id, fields);
  for (const record of changes.create) rates.create(record);
  const results = await batch.send();
  // Deletes answer with a null body; the rest are the saved records.
  const saved = results.flatMap((result) => {
    const item = BatchItem.parse(result);
    return item.body === null ? [] : [item.body];
  });
  return parseRecords(RateRecordRecord, saved, 'rate_records');
}

/** The repository over the two SDK clients. Pass others in tests; the app builds them from its origin. */
export function createPocketBaseRepository(clients: Readonly<Record<Instance, PocketBase>>): PeopleRepository {
  const { people, delivery } = clients;
  return {
    listEmployees: () =>
      guarded('people', async () =>
        parseRecords(EmployeeRecord, await people.collection(PEOPLE_COLLECTIONS.employees).getFullList(), 'employees'),
      ),
    listRateRecords: () =>
      guarded('people', async () =>
        parseRecords(
          RateRecordRecord,
          await people.collection(PEOPLE_COLLECTIONS.rateRecords).getFullList(),
          'rate_records',
        ),
      ),
    listEmployeeMonthLoads: () =>
      guarded('delivery', async () =>
        parseRecords(
          EmployeeMonthLoadRecord,
          await delivery.collection(DELIVERY_COLLECTIONS.employeeMonthLoads).getFullList(),
          'employee_month_loads',
        ),
      ),
    applyRateChanges: (changes) =>
      changes.create.length + changes.update.length + changes.delete.length === 0
        ? Promise.resolve([])
        : guarded('people', () => sendRateChanges(people, changes)),
    subscribe: (instance, handlers) => subscribeToInstance(clients[instance], TOPICS[instance], handlers),
  };
}

/** The app's repository: both SDK clients, built from the page's origin (the gateway serves both APIs). */
export function createAppRepository(origin: string): PeopleRepository {
  return createPocketBaseRepository({ people: createPeopleClient(origin), delivery: createDeliveryClient(origin) });
}
