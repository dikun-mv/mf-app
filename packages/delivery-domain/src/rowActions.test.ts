import { BreakdownItemId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { applyChangeSet } from './changeSet';
import { moveItem } from './tree';
import { type MoveTarget, type RowAction, describeMoveRefusal, moveTargets, rowActions } from './rowActions';
import { seedPlan } from './testing/seed';
import { allocation, item, plan, project } from './testing/stateBuilders';

const wbs = (id: string) => BreakdownItemId.parse(id);

/**
 * prj-1:  Ledger ─ Discovery ─ Design         (Design is a leaf at the third level)
 *               └ Rework                      (leaf, 2 allocations)
 *         Spare                               (leaf, empty)
 *         Cut-over ─ Pilot                    (Pilot: leaf, 1 allocation clashing with Rework's)
 *         Archive                             (leaf, 1 allocation)
 * prj-2:  Other
 */
const state = plan({
  projects: [project('prj-1'), project('prj-2')],
  items: [
    item('wbs-1', 'prj-1', null, 'Ledger'),
    item('wbs-11', 'prj-1', 'wbs-1', 'Discovery'),
    item('wbs-111', 'prj-1', 'wbs-11', 'Design'),
    item('wbs-12', 'prj-1', 'wbs-1', 'Rework'),
    item('wbs-2', 'prj-1', null, 'Spare'),
    item('wbs-3', 'prj-1', null, 'Cut-over'),
    item('wbs-31', 'prj-1', 'wbs-3', 'Pilot'),
    item('wbs-4', 'prj-1', null, 'Archive'),
    item('wbs-9', 'prj-2', null, 'Other'),
  ],
  allocations: [
    allocation('alloc-1', 'wbs-12', 'emp-001', '2026-03', 0.5),
    allocation('alloc-2', 'wbs-12', 'emp-002', '2026-04', 0.25),
    allocation('alloc-3', 'wbs-31', 'emp-001', '2026-03', 0.3),
    allocation('alloc-4', 'wbs-4', 'emp-005', '2026-03', 0.1),
  ],
});

function actionsOf(id: string): RowAction[] {
  const result = rowActions(state, wbs(id));
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return [...result.value];
}

function targetsOf(id: string): Map<string, MoveTarget> {
  const result = moveTargets(state, wbs(id));
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return new Map(result.value.map((target) => [target.label, target]));
}

const reasonOf = (target: MoveTarget | undefined): string | null =>
  target === undefined || target.allowed ? null : target.reason;

describe('rowActions (screens 3.4)', () => {
  it('lists the five actions in a fixed order', () => {
    expect(actionsOf('wbs-1').map((action) => action.id)).toEqual([
      'rename',
      'addChild',
      'move',
      'delete',
      'assignPerson',
    ]);
    expect(actionsOf('wbs-1').map((action) => action.label)).toEqual([
      'Rename',
      'Add child item',
      'Move…',
      'Delete…',
      'Assign person…',
    ]);
  });

  it('allows everything but assigning people on a node with sub-items', () => {
    const actions = actionsOf('wbs-3');
    expect(actions.map((action) => action.allowed)).toEqual([true, true, true, true, false]);
    expect(actions[1]).toMatchObject({ allowed: true, movesAllocations: 0 });
    expect(actions[4]).toEqual({
      id: 'assignPerson',
      label: 'Assign person…',
      allowed: false,
      reason: 'Cut-over has sub-items, and people are assigned to leaves',
    });
  });

  it('refuses a move for a three-level subtree, which fits nowhere but where it is', () => {
    expect(actionsOf('wbs-1')[2]).toMatchObject({ id: 'move', allowed: false });
  });

  it('refuses a child under an item at the third level, naming it', () => {
    const actions = actionsOf('wbs-111');
    expect(actions[1]).toEqual({
      id: 'addChild',
      label: 'Add child item',
      allowed: false,
      reason: 'Design is at the third level, the deepest',
    });
    expect(actions[4]).toMatchObject({ id: 'assignPerson', allowed: true });
  });

  it('says how many allocations a new child takes over from a leaf that holds them (D9)', () => {
    expect(actionsOf('wbs-12')[1]).toMatchObject({ id: 'addChild', allowed: true, movesAllocations: 2 });
    expect(actionsOf('wbs-2')[1]).toMatchObject({ id: 'addChild', allowed: true, movesAllocations: 0 });
  });

  it('refuses a move when no place is left, naming the item', () => {
    const alone = plan({ projects: [project('prj-1')], items: [item('wbs-1', 'prj-1', null, 'Only')] });
    const result = rowActions(alone, wbs('wbs-1'));
    expect(result.ok && result.value[2]).toEqual({
      id: 'move',
      label: 'Move…',
      allowed: false,
      reason: 'there is nowhere else to move Only',
    });
  });

  it('always allows rename and delete, and fails for an unknown item', () => {
    for (const id of ['wbs-1', 'wbs-111', 'wbs-12', 'wbs-31']) {
      expect(actionsOf(id)[0]).toMatchObject({ id: 'rename', allowed: true });
      expect(actionsOf(id)[3]).toMatchObject({ id: 'delete', allowed: true });
    }
    expect(rowActions(state, wbs('wbs-404'))).toEqual({
      ok: false,
      error: { code: 'notFound', entity: 'breakdownItem', id: 'wbs-404' },
    });
  });
});

describe('moveTargets (screens 3.4, D15)', () => {
  it('lists the top level, then every node of the same project in tree order, with its path and depth', () => {
    const result = moveTargets(state, wbs('wbs-12'));
    expect(result.ok && result.value.map((target) => [target.label, target.depth])).toEqual([
      ['Top level', 0],
      ['Ledger', 1],
      ['Ledger › Discovery', 2],
      ['Ledger › Discovery › Design', 3],
      ['Ledger › Rework', 2],
      ['Spare', 1],
      ['Cut-over', 1],
      ['Cut-over › Pilot', 2],
      ['Archive', 1],
    ]);
  });

  it('never offers a node of another project', () => {
    expect(targetsOf('wbs-12').has('Other')).toBe(false);
  });

  it('refuses the current parent, and the top level for a root', () => {
    expect(reasonOf(targetsOf('wbs-12').get('Ledger'))).toBe('current parent');
    expect(reasonOf(targetsOf('wbs-2').get('Top level'))).toBe('current parent');
    expect(targetsOf('wbs-12').get('Top level')).toMatchObject({ parentId: null, allowed: true });
  });

  it('refuses the item itself and what is under it (a cycle)', () => {
    expect(reasonOf(targetsOf('wbs-1').get('Ledger'))).toBe("can't move into itself");
    expect(reasonOf(targetsOf('wbs-1').get('Ledger › Discovery'))).toBe('inside "Ledger", which is being moved');
    expect(reasonOf(targetsOf('wbs-1').get('Ledger › Discovery › Design'))).toBe(
      'inside "Ledger", which is being moved',
    );
  });

  it('refuses a third-level target, which can take no child', () => {
    expect(reasonOf(targetsOf('wbs-12').get('Ledger › Discovery › Design'))).toBe("third level: can't take a child");
  });

  it('refuses a target that would push the moved subtree past three levels', () => {
    // Cut-over has a child, so under Rework (level 2) it would reach level 4.
    expect(reasonOf(targetsOf('wbs-3').get('Ledger › Rework'))).toBe(
      '"Cut-over" and what is under it would go past the third level',
    );
  });

  it('allows a leaf target without allocations, and a parent, and counts nothing to move', () => {
    expect(targetsOf('wbs-12').get('Spare')).toMatchObject({ allowed: true, movesAllocations: 0 });
    expect(targetsOf('wbs-12').get('Cut-over')).toMatchObject({ allowed: true, movesAllocations: 0 });
  });

  it('allows a leaf with allocations as a target, counting what moves onto the moved leaf (D9)', () => {
    expect(targetsOf('wbs-2').get('Archive')).toMatchObject({ allowed: true, movesAllocations: 1 });
  });

  it('refuses a leaf with allocations when the moved item has sub-items to keep them from', () => {
    expect(reasonOf(targetsOf('wbs-3').get('Archive'))).toBe(
      'holds allocations, and "Cut-over" has sub-items, so they have nowhere to go',
    );
  });

  it('refuses a leaf whose allocations would clash with the moved leaf’s own', () => {
    expect(reasonOf(targetsOf('wbs-12').get('Cut-over › Pilot'))).toBe(
      '1 of its allocations would clash with those of "Rework"',
    );
  });

  it('fails for an unknown item', () => {
    expect(moveTargets(state, wbs('wbs-404')).ok).toBe(false);
  });

  it('agrees with moveItem for every target of every item', () => {
    for (const source of state.items) {
      const result = moveTargets(state, source.id);
      if (!result.ok) throw new Error('expected ok');
      for (const target of result.value) {
        const moved = moveItem(state, source.id, target.parentId);
        const unchanged = moved.ok && moved.value.update.items.length === 0;
        expect(target.allowed).toBe(moved.ok && !unchanged);
      }
    }
  });
});

describe('describeMoveRefusal', () => {
  it('names the error code for a refusal the tree does not produce here', () => {
    const [source] = state.items;
    if (source === undefined) throw new Error('no items');
    expect(describeMoveRefusal({ code: 'emptyName' }, source, null, 0)).toBe("can't move here (emptyName)");
  });
});

describe('on the seed (screens 3.4: moving "Rework" in Ledger Consolidation)', () => {
  const seeded = seedPlan();
  const rework = seeded.items.find((entry) => entry.name === 'Rework' && entry.projectId === 'prj-1');

  it('refuses the current parent and the third-level Design, as the mockup shows', () => {
    if (rework === undefined) throw new Error('no Rework in prj-1');
    const result = moveTargets(seeded, rework.id);
    if (!result.ok) throw new Error('expected ok');
    const byLabel = new Map(result.value.map((target) => [target.label, target]));
    expect(byLabel.get('Top level')).toMatchObject({ allowed: true });
    expect(byLabel.get('Ledger migration')).toMatchObject({ allowed: true });
    expect(reasonOf(byLabel.get('Ledger migration › Discovery'))).toBe('current parent');
    expect(reasonOf(byLabel.get('Ledger migration › Discovery › Design'))).toBe("third level: can't take a child");
    expect(byLabel.get('Ledger migration › Migration')).toMatchObject({ allowed: true });
    expect([...byLabel.keys()].some((label) => label.startsWith('Client Portal'))).toBe(false);
  });

  it('refuses a child under Design with the mockup’s wording', () => {
    const design = seeded.items.find((entry) => entry.name === 'Design' && entry.projectId === 'prj-1');
    if (design === undefined) throw new Error('no Design in prj-1');
    const result = rowActions(seeded, design.id);
    expect(result.ok && result.value[1]).toMatchObject({
      allowed: false,
      reason: 'Design is at the third level, the deepest',
    });
  });

  it('only offers moves that the change set then applies cleanly', () => {
    if (rework === undefined) throw new Error('no Rework in prj-1');
    const result = moveTargets(seeded, rework.id);
    if (!result.ok) throw new Error('expected ok');
    for (const target of result.value.filter((candidate) => candidate.allowed)) {
      const moved = moveItem(seeded, rework.id, target.parentId);
      expect(moved.ok).toBe(true);
      if (moved.ok) applyChangeSet(seeded, moved.value);
    }
  });
});
