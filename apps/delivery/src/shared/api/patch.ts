// Patching a cached collection by record id (D26, D29). Every record is a flat object of strings, numbers
// and nulls, and every helper returns the very same array when nothing changes, so a realtime echo of a
// record the cache already holds changes no reference and re-renders nothing (D35).

interface HasId {
  readonly id: string;
}

const sameRecord = (a: object, b: object): boolean => {
  const entriesA = Object.entries(a);
  return (
    entriesA.length === Object.keys(b).length &&
    entriesA.every(([field, value]) => Object.is(value, Reflect.get(b, field)))
  );
};

/** Replaces the record with the same id, or appends it. */
export function upsertRecord<T extends HasId>(records: readonly T[], record: T): readonly T[] {
  const index = records.findIndex(({ id }) => id === record.id);
  if (index === -1) return [...records, record];
  const current = records[index];
  if (current !== undefined && sameRecord(current, record)) return records;
  return records.with(index, record);
}

/** Removes the record with this id, if it is there. */
export function removeRecord<T extends HasId>(records: readonly T[], id: string): readonly T[] {
  return records.some((record) => record.id === id) ? records.filter((record) => record.id !== id) : records;
}

/** Puts `record` in place of whatever has its id, or removes it when it is `undefined`: the undo of a write. */
export function restoreRecord<T extends HasId>(records: readonly T[], id: string, record: T | undefined): readonly T[] {
  return record === undefined ? removeRecord(records, id) : upsertRecord(records, record);
}
