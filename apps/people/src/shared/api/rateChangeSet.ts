import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import type { RateChangeSet } from './repository';

/**
 * Applies a change set to the cached rate records: deletes, then replaces, then appends. Pure, and the one
 * place a rate change set is applied (D26). A set made against another state, one that updates a record
 * that isn't there, is a bug, so that throws.
 */
export function applyRateChangeSet(records: readonly RateRecord[], changes: RateChangeSet): RateRecord[] {
  const deleted = new Set<string>(changes.delete);
  const replacements = new Map(changes.update.map((record) => [record.id, record]));
  const kept = records.filter((record) => !deleted.has(record.id));
  const missing = changes.update.find((record) => !kept.some((existing) => existing.id === record.id));
  if (missing !== undefined) throw new Error(`Change set updates ${missing.id}, which is not in the state`);
  return [...kept.map((record) => replacements.get(record.id) ?? record), ...changes.create];
}

/** Every record id a change set touches, once. */
export function touchedRateIds(changes: RateChangeSet): RateRecordId[] {
  return [
    ...new Set([...changes.create.map(({ id }) => id), ...changes.update.map(({ id }) => id), ...changes.delete]),
  ];
}
