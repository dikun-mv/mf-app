import { EMPTY_CHANGE_SET, type ChangeSet } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import { allocation, item } from '../testing';
import { batchOperations } from './batch';

const idsOf = (changeSet: ChangeSet) =>
  batchOperations(changeSet).map(({ op, collection, id }) => `${op} ${collection} ${id}`);

describe('batchOperations', () => {
  it('sends nothing for an empty change set', () => {
    expect(batchOperations(EMPTY_CHANGE_SET)).toEqual([]);
  });

  it('deletes allocations first, then items children first (the domain lists a subtree parent first)', () => {
    expect(
      idsOf({
        ...EMPTY_CHANGE_SET,
        delete: {
          itemIds: [
            item('wbs-1', 'prj-1', null).id,
            item('wbs-2', 'prj-1', 'wbs-1').id,
            item('wbs-3', 'prj-1', 'wbs-2').id,
          ],
          allocationIds: [allocation('alloc-1', 'wbs-3', 'emp-001', '2026-03', 1).id],
        },
      }),
    ).toEqual([
      'delete allocations alloc-1',
      'delete breakdownItems wbs-3',
      'delete breakdownItems wbs-2',
      'delete breakdownItems wbs-1',
    ]);
  });

  it('creates a parent before its child, whatever order the set lists them in', () => {
    const child = item('wbs-2', 'prj-1', 'wbs-1');
    const parent = item('wbs-1', 'prj-1', null);
    const grandchild = item('wbs-3', 'prj-1', 'wbs-2');
    expect(idsOf({ ...EMPTY_CHANGE_SET, create: { items: [grandchild, child, parent], allocations: [] } })).toEqual([
      'create breakdownItems wbs-1',
      'create breakdownItems wbs-2',
      'create breakdownItems wbs-3',
    ]);
  });

  it('treats a parent outside the set as already there', () => {
    expect(
      idsOf({ ...EMPTY_CHANGE_SET, create: { items: [item('wbs-2', 'prj-1', 'wbs-1')], allocations: [] } }),
    ).toEqual(['create breakdownItems wbs-2']);
  });

  it('refuses a set that creates items that are each other’s parents', () => {
    const a = item('wbs-1', 'prj-1', 'wbs-2');
    const b = item('wbs-2', 'prj-1', 'wbs-1');
    expect(() => batchOperations({ ...EMPTY_CHANGE_SET, create: { items: [a, b], allocations: [] } })).toThrow(
      /parents/,
    );
  });

  it('orders a D9 child-under-leaf: create the child, then re-point the allocation to it', () => {
    const moved = allocation('alloc-1', 'wbs-9', 'emp-001', '2026-03', 1);
    expect(
      idsOf({
        create: { items: [item('wbs-9', 'prj-1', 'wbs-1')], allocations: [] },
        update: { items: [], allocations: [moved] },
        delete: { itemIds: [], allocationIds: [] },
      }),
    ).toEqual(['create breakdownItems wbs-9', 'update allocations alloc-1']);
  });

  it('puts every create and update in the order items, then allocations', () => {
    expect(
      idsOf({
        create: {
          items: [item('wbs-9', 'prj-1', null)],
          allocations: [allocation('alloc-2', 'wbs-9', 'emp-001', '2026-04', 1)],
        },
        update: {
          items: [item('wbs-1', 'prj-1', null, 'Renamed')],
          allocations: [allocation('alloc-1', 'wbs-9', 'emp-001', '2026-03', 2)],
        },
        delete: { itemIds: [], allocationIds: [] },
      }),
    ).toEqual([
      'create breakdownItems wbs-9',
      'update breakdownItems wbs-1',
      'create allocations alloc-2',
      'update allocations alloc-1',
    ]);
  });

  it('sends a root’s parent as an empty string and leaves editedAt to the server', () => {
    const [root, effort] = batchOperations({
      create: {
        items: [item('wbs-1', 'prj-1', null, 'Root')],
        allocations: [allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.5)],
      },
      update: { items: [], allocations: [] },
      delete: { itemIds: [], allocationIds: [] },
    });
    expect(root).toMatchObject({ body: { id: 'wbs-1', projectId: 'prj-1', parentId: '', name: 'Root' } });
    expect(effort).toMatchObject({
      body: { id: 'alloc-1', breakdownItemId: 'wbs-1', employeeId: 'emp-001', month: '2026-03', amount: 0.5 },
    });
    expect(effort && 'body' in effort ? Object.keys(effort.body) : []).not.toContain('editedAt');
  });
});
