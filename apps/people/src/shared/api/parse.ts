import { EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { EmployeeRecord, RateRecordRecord } from '@baseline/people-contract';
import { z } from 'zod';
import type { RecordEvent } from './repository';

// Everything that enters the app from PocketBase is parsed here, with the contract schemas (D21). A record
// that fails is logged and dropped, never cached (D29): one bad row, which only a hand-made API call can
// make (ADR 034), must not blank a page.

/** Parses each raw record; the ones that fail their schema are skipped and logged. */
export function parseRecords<T>(schema: z.ZodType<T>, raw: readonly unknown[], what: string): T[] {
  const parsed: T[] = [];
  for (const item of raw) {
    const result = schema.safeParse(item);
    if (result.success) parsed.push(result.data);
    else console.warn(`Skipped a ${what} record that fails its schema`, result.error.issues);
  }
  return parsed;
}

const Envelope = z.object({ action: z.enum(['create', 'update', 'delete']), record: z.unknown() });

/** The collections that have realtime events, as the keys of `RecordEvent`. */
export type EventCollection = RecordEvent['collection'];

/** Parses one realtime message of `collection`. `null` (and a log line) when it isn't a well-formed event. */
export function parseRecordEvent(collection: EventCollection, raw: unknown): RecordEvent | null {
  const envelope = Envelope.safeParse(raw);
  if (!envelope.success) {
    console.warn(`Dropped a ${collection} event that is not an event`, envelope.error.issues);
    return null;
  }
  const { action, record } = envelope.data;
  switch (collection) {
    case 'employees':
      return withRecord(EmployeeRecord.safeParse(record), (parsed) => ({ collection, action, record: parsed }));
    case 'rateRecords':
      return withRecord(RateRecordRecord.safeParse(record), (parsed) => ({ collection, action, record: parsed }));
    case 'employeeMonthLoads':
      return withRecord(EmployeeMonthLoadRecord.safeParse(record), (parsed) => ({
        collection,
        action,
        record: parsed,
      }));
  }
}

function withRecord<T>(result: z.ZodSafeParseResult<T>, build: (record: T) => RecordEvent): RecordEvent | null {
  if (result.success) return build(result.data);
  console.warn('Dropped a realtime event whose record fails its schema', result.error.issues);
  return null;
}
