import { describe, expect, it } from '@rstest/core';
import { EMPTY_CHANGE_SET, isEmptyChangeSet } from './changeSet';
import { allocation, item } from './testing/stateBuilders';

describe('isEmptyChangeSet', () => {
  it('is true only when nothing is created, updated or deleted', () => {
    expect(isEmptyChangeSet(EMPTY_CHANGE_SET)).toBe(true);
  });

  it.each([
    [
      'a created item',
      { ...EMPTY_CHANGE_SET, create: { ...EMPTY_CHANGE_SET.create, items: [item('wbs-1', 'prj-1', null)] } },
    ],
    [
      'a created allocation',
      {
        ...EMPTY_CHANGE_SET,
        create: { ...EMPTY_CHANGE_SET.create, allocations: [allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 1)] },
      },
    ],
    [
      'an updated item',
      { ...EMPTY_CHANGE_SET, update: { ...EMPTY_CHANGE_SET.update, items: [item('wbs-1', 'prj-1', null)] } },
    ],
    [
      'an updated allocation',
      {
        ...EMPTY_CHANGE_SET,
        update: { ...EMPTY_CHANGE_SET.update, allocations: [allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 1)] },
      },
    ],
    [
      'a deleted item',
      { ...EMPTY_CHANGE_SET, delete: { ...EMPTY_CHANGE_SET.delete, itemIds: [item('wbs-1', 'prj-1', null).id] } },
    ],
    [
      'a deleted allocation',
      {
        ...EMPTY_CHANGE_SET,
        delete: {
          ...EMPTY_CHANGE_SET.delete,
          allocationIds: [allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 1).id],
        },
      },
    ],
  ])('is false with %s', (_label, changeSet) => {
    expect(isEmptyChangeSet(changeSet)).toBe(false);
  });
});
