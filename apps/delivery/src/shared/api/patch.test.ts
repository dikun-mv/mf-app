import { describe, expect, it } from '@rstest/core';
import { removeRecord, restoreRecord, upsertRecord } from './patch';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

const a: Row = { id: 'a', name: 'A', parentId: null };
const b: Row = { id: 'b', name: 'B', parentId: 'a' };

describe('upsertRecord', () => {
  it('replaces the record with the same id, in place', () => {
    const renamed = { ...a, name: 'Renamed' };
    expect(upsertRecord([a, b], renamed)).toEqual([renamed, b]);
  });

  it('appends a record it does not have', () => {
    const c: Row = { id: 'c', name: 'C', parentId: null };
    expect(upsertRecord([a, b], c)).toEqual([a, b, c]);
  });

  it('returns the very same array for an echo of what it already holds', () => {
    const records = [a, b];
    expect(upsertRecord(records, { ...a })).toBe(records);
  });

  it('does not treat a changed field, or a null that became a value, as the same', () => {
    const records = [a, b];
    expect(upsertRecord(records, { ...a, parentId: 'b' })).not.toBe(records);
  });
});

describe('removeRecord', () => {
  it('removes the record', () => {
    expect(removeRecord([a, b], 'a')).toEqual([b]);
  });

  it('returns the same array when the record is not there', () => {
    const records = [a, b];
    expect(removeRecord(records, 'z')).toBe(records);
  });
});

describe('restoreRecord', () => {
  it('puts the previous record back', () => {
    expect(restoreRecord([{ ...a, name: 'Edited' }, b], 'a', a)).toEqual([a, b]);
  });

  it('removes a record that did not exist before', () => {
    expect(restoreRecord([a, b], 'b', undefined)).toEqual([a]);
  });
});
