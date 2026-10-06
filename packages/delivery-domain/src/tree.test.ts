import { AllocationId, BreakdownItemId, ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { applyChangeSet } from './changeSet';
import { checkInvariants } from './invariants';
import {
  MAX_DEPTH,
  createItem,
  deleteItem,
  depthOf,
  heightOf,
  indexItems,
  moveItem,
  renameItem,
  rootsOf,
  subtreeOf,
} from './tree';
import { allocation, item, plan, project } from './testing/stateBuilders';

const wbs = (n: string) => BreakdownItemId.parse(`wbs-${n}`);
const prj = (n: string) => ProjectId.parse(`prj-${n}`);

/**
 * prj-1:  wbs-1 ─ wbs-11 ─ wbs-111   (3 levels)
 *                └ wbs-12            (leaf with 2 allocations)
 *         wbs-2                      (leaf, empty)
 * prj-2:  wbs-9
 */
const state = plan({
  projects: [project('prj-1'), project('prj-2')],
  items: [
    item('wbs-1', 'prj-1', null),
    item('wbs-11', 'prj-1', 'wbs-1'),
    item('wbs-111', 'prj-1', 'wbs-11'),
    item('wbs-12', 'prj-1', 'wbs-1'),
    item('wbs-2', 'prj-1', null),
    item('wbs-9', 'prj-2', null),
  ],
  allocations: [
    allocation('alloc-1', 'wbs-12', 'emp-001', '2026-03', 0.5),
    allocation('alloc-2', 'wbs-12', 'emp-001', '2026-04', 0.25),
    allocation('alloc-3', 'wbs-111', 'emp-002', '2026-03', 0.3),
  ],
});

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('tree queries', () => {
  const index = indexItems(state.items);

  it('finds depth, height, roots and subtrees', () => {
    expect(depthOf(index, wbs('1'))).toBe(1);
    expect(depthOf(index, wbs('111'))).toBe(3);
    expect(heightOf(index, wbs('1'))).toBe(3);
    expect(heightOf(index, wbs('12'))).toBe(1);
    expect(rootsOf(state.items, prj('1')).map((i) => i.id)).toEqual(['wbs-1', 'wbs-2']);
    expect(subtreeOf(index, wbs('1')).map((i) => i.id)).toEqual(['wbs-1', 'wbs-11', 'wbs-111', 'wbs-12']);
    expect(subtreeOf(index, wbs('404'))).toEqual([]);
  });
});

describe('depthOf on broken data', () => {
  it('throws rather than looping when items form a cycle', () => {
    const cyclic = indexItems([item('wbs-1', 'prj-1', 'wbs-2'), item('wbs-2', 'prj-1', 'wbs-1')]);
    expect(() => depthOf(cyclic, wbs('1'))).toThrow(RangeError);
  });
});

describe('createItem', () => {
  const draft = { id: wbs('20'), projectId: prj('1'), parentId: null, name: '  New  ' };

  it('adds a root with a trimmed name', () => {
    const changes = expectOk(createItem(state, draft));
    expect(changes.create.items).toEqual([{ id: 'wbs-20', projectId: 'prj-1', parentId: null, name: 'New' }]);
    expect(changes.update.allocations).toEqual([]);
  });

  it('refuses an empty name, a duplicate id, an unknown project or parent, and a parent in another project', () => {
    expect(createItem(state, { ...draft, name: '  ' })).toEqual({ ok: false, error: { code: 'emptyName' } });
    expect(createItem(state, { ...draft, id: wbs('1') })).toEqual({
      ok: false,
      error: { code: 'duplicateId', id: 'wbs-1' },
    });
    expect(createItem(state, { ...draft, projectId: prj('7') })).toMatchObject({
      ok: false,
      error: { code: 'notFound', entity: 'project' },
    });
    expect(createItem(state, { ...draft, parentId: wbs('404') })).toMatchObject({
      ok: false,
      error: { code: 'notFound', entity: 'breakdownItem' },
    });
    expect(createItem(state, { ...draft, parentId: wbs('9') })).toEqual({
      ok: false,
      error: { code: 'parentInOtherProject', parentId: 'wbs-9' },
    });
  });

  it(`refuses a fourth level (${String(MAX_DEPTH)} is the limit)`, () => {
    expect(createItem(state, { ...draft, parentId: wbs('111') })).toEqual({
      ok: false,
      error: { code: 'tooDeep', maxDepth: 3 },
    });
  });

  it('moves a leaf’s allocations onto its new first child, losing nothing (D9, brief §3.8)', () => {
    const changes = expectOk(createItem(state, { ...draft, parentId: wbs('12') }));
    expect(changes.update.allocations.map((a) => [a.id, a.breakdownItemId])).toEqual([
      ['alloc-1', 'wbs-20'],
      ['alloc-2', 'wbs-20'],
    ]);
    const after = applyChangeSet(state, changes);
    expect(after.allocations).toHaveLength(3);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('keeps editedAt when it moves allocations (D18)', () => {
    const edited = plan({
      ...state,
      allocations: [allocation('alloc-1', 'wbs-12', 'emp-001', '2026-03', 0.5, '2026-02-02T00:00:00.000Z')],
    });
    const changes = expectOk(createItem(edited, { ...draft, parentId: wbs('12') }));
    expect(changes.update.allocations[0]?.editedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('moves nothing when the parent already has children', () => {
    const changes = expectOk(createItem(state, { ...draft, parentId: wbs('1') }));
    expect(changes.update.allocations).toEqual([]);
  });

  it('does not mutate the state', () => {
    const copy = structuredClone(state);
    createItem(state, { ...draft, parentId: wbs('12') });
    expect(state).toEqual(copy);
  });
});

describe('renameItem', () => {
  it('replaces the name', () => {
    const changes = expectOk(renameItem(state, wbs('2'), ' Renamed '));
    expect(changes.update.items).toEqual([{ id: 'wbs-2', projectId: 'prj-1', parentId: null, name: 'Renamed' }]);
  });

  it('is a no-op for the same name, and refuses empty or unknown', () => {
    expect(expectOk(renameItem(state, wbs('2'), 'Item wbs-2')).update.items).toEqual([]);
    expect(renameItem(state, wbs('2'), '')).toEqual({ ok: false, error: { code: 'emptyName' } });
    expect(renameItem(state, wbs('404'), 'x')).toMatchObject({ ok: false, error: { code: 'notFound' } });
  });
});

describe('moveItem', () => {
  it('moves an item under another parent, or to the root', () => {
    expect(expectOk(moveItem(state, wbs('2'), wbs('1'))).update.items).toEqual([
      { id: 'wbs-2', projectId: 'prj-1', parentId: 'wbs-1', name: 'Item wbs-2' },
    ]);
    expect(expectOk(moveItem(state, wbs('12'), null)).update.items[0]?.parentId).toBeNull();
  });

  it('does nothing when the parent is unchanged', () => {
    const changes = expectOk(moveItem(state, wbs('12'), wbs('1')));
    expect(changes.update.items).toEqual([]);
  });

  it('forbids moving across projects (D15)', () => {
    expect(moveItem(state, wbs('2'), wbs('9'))).toEqual({
      ok: false,
      error: { code: 'crossProjectMove', itemId: 'wbs-2', fromProjectId: 'prj-1', toProjectId: 'prj-2' },
    });
  });

  it('forbids moving into itself or its own subtree', () => {
    expect(moveItem(state, wbs('1'), wbs('1'))).toMatchObject({ ok: false, error: { code: 'cycle' } });
    expect(moveItem(state, wbs('1'), wbs('111'))).toMatchObject({ ok: false, error: { code: 'cycle' } });
  });

  it('forbids a result deeper than three levels', () => {
    // wbs-1 has height 3; under the leaf wbs-2 it would be level 4.
    expect(moveItem(state, wbs('1'), wbs('2'))).toEqual({ ok: false, error: { code: 'tooDeep', maxDepth: 3 } });
    // wbs-11 (height 2) under wbs-11's sibling wbs-12 reaches exactly level 3.
    expect(moveItem(state, wbs('11'), wbs('12')).ok).toBe(false); // wbs-12 has allocations and wbs-11 isn't a leaf
    expect(moveItem(state, wbs('111'), wbs('2')).ok).toBe(true);
  });

  it('hands a target leaf’s allocations to the moved leaf (D9)', () => {
    const changes = expectOk(moveItem(state, wbs('2'), wbs('12')));
    expect(changes.update.items[0]?.parentId).toBe('wbs-12');
    expect(changes.update.allocations.map((a) => [a.id, a.breakdownItemId])).toEqual([
      ['alloc-1', 'wbs-2'],
      ['alloc-2', 'wbs-2'],
    ]);
    const after = applyChangeSet(state, changes);
    expect(after.allocations).toHaveLength(3);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('refuses to move a parent onto a leaf with allocations, which would leave them nowhere to go', () => {
    const deeper = plan({
      ...state,
      items: [...state.items, item('wbs-3', 'prj-1', null), item('wbs-31', 'prj-1', 'wbs-3')],
      allocations: [...state.allocations, allocation('alloc-5', 'wbs-2', 'emp-003', '2026-03', 0.2)],
    });
    expect(moveItem(deeper, wbs('3'), wbs('2'))).toEqual({
      ok: false,
      error: { code: 'targetHasAllocations', parentId: 'wbs-2' },
    });
  });

  it('refuses when the handed-over allocations collide with the moved leaf’s own', () => {
    const colliding = plan({
      ...state,
      allocations: [...state.allocations, allocation('alloc-4', 'wbs-2', 'emp-001', '2026-03', 0.1)],
    });
    expect(moveItem(colliding, wbs('2'), wbs('12'))).toEqual({
      ok: false,
      error: { code: 'allocationConflict', itemId: 'wbs-2', conflicts: 1 },
    });
  });

  it('moves onto an empty leaf without touching allocations', () => {
    expect(expectOk(moveItem(state, wbs('12'), wbs('2'))).update.allocations).toEqual([]);
  });

  it('refuses unknown ids', () => {
    expect(moveItem(state, wbs('404'), null)).toMatchObject({ ok: false, error: { code: 'notFound' } });
    expect(moveItem(state, wbs('2'), wbs('404'))).toMatchObject({ ok: false, error: { code: 'notFound' } });
  });
});

describe('deleteItem', () => {
  it('deletes the subtree and reports the allocations it removes', () => {
    const changes = expectOk(deleteItem(state, wbs('1')));
    expect(changes.delete.itemIds).toEqual(['wbs-1', 'wbs-11', 'wbs-111', 'wbs-12']);
    expect(changes.delete.allocationIds).toEqual(['alloc-1', 'alloc-2', 'alloc-3']);
    const after = applyChangeSet(state, changes);
    expect(after.items.map((i) => i.id)).toEqual(['wbs-2', 'wbs-9']);
    expect(after.allocations).toEqual([]);
  });

  it('refuses an unknown id', () => {
    expect(deleteItem(state, wbs('404'))).toMatchObject({ ok: false, error: { code: 'notFound' } });
  });
});

describe('applyChangeSet', () => {
  it('replaces in place and appends creations', () => {
    const changes = expectOk(
      createItem(state, { id: wbs('20'), projectId: prj('1'), parentId: wbs('12'), name: 'Child' }),
    );
    const after = applyChangeSet(state, changes);
    expect(after.items.at(-1)?.id).toBe('wbs-20');
    expect(after.allocations.map((a) => a.id)).toEqual(['alloc-1', 'alloc-2', 'alloc-3']);
    expect(after.allocations[0]?.breakdownItemId).toBe('wbs-20');
  });

  it('throws when a change set updates a record the state does not hold', () => {
    const changes = expectOk(renameItem(state, wbs('2'), 'Other'));
    expect(() => applyChangeSet(plan({ projects: state.projects }), changes)).toThrow();
  });

  it('leaves the input state untouched', () => {
    const copy = structuredClone(state);
    applyChangeSet(state, expectOk(deleteItem(state, wbs('1'))));
    expect(state).toEqual(copy);
    expect(AllocationId.parse('alloc-1')).toBe('alloc-1');
  });
});
