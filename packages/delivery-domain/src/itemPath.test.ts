import { BreakdownItemId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { itemPath, trailOf } from './itemPath';
import { seedPlan } from './testing/seed';
import { item, plan, project } from './testing/stateBuilders';
import { indexItems } from './tree';

const wbs = (id: string) => BreakdownItemId.parse(id);

const state = plan({
  projects: [project('prj-1')],
  items: [
    item('wbs-1', 'prj-1', null, 'Ledger migration'),
    item('wbs-2', 'prj-1', 'wbs-1', 'Discovery'),
    item('wbs-3', 'prj-1', 'wbs-2', 'Design'),
    item('wbs-4', 'prj-2', null, 'Orphan'), // Its project isn't in the state.
  ],
});

describe('itemPath (screens 3.3)', () => {
  it('names the project and every level down to the item', () => {
    expect(itemPath(state, wbs('wbs-3'))).toBe('Project prj-1 › Ledger migration › Discovery › Design');
    expect(itemPath(state, wbs('wbs-1'))).toBe('Project prj-1 › Ledger migration');
  });

  it('gives the same answer from a prepared index', () => {
    expect(itemPath(state, wbs('wbs-2'), indexItems(state.items))).toBe('Project prj-1 › Ledger migration › Discovery');
  });

  it('is null for an item that is not in the state, or whose project is not', () => {
    expect(itemPath(state, wbs('wbs-404'))).toBeNull();
    expect(itemPath(state, wbs('wbs-4'))).toBeNull();
  });

  it('reads a seed causer: the path of the over-capacity cell in the brief', () => {
    // Milan Brandt, June 2026: the cause is alloc-073, in Client Portal Rebuild, not in the Ledger project.
    const seeded = seedPlan();
    const causer = seeded.allocations.find((allocation) => allocation.id === 'alloc-073');
    expect(causer).toBeDefined();
    expect(itemPath(seeded, wbs(causer?.breakdownItemId ?? ''))).toBe(
      'Client Portal Rebuild › Account management › Core build › Implementation',
    );
  });
});

describe('trailOf', () => {
  it('lists the ancestors root first, and nothing for an unknown item', () => {
    const index = indexItems(state.items);
    expect(trailOf(index, wbs('wbs-3')).map((entry) => entry.name)).toEqual([
      'Ledger migration',
      'Discovery',
      'Design',
    ]);
    expect(trailOf(index, wbs('wbs-404'))).toEqual([]);
  });

  it('stops at a parent that is missing rather than failing', () => {
    const dangling = indexItems([item('wbs-5', 'prj-1', 'wbs-404')]);
    expect(trailOf(dangling, wbs('wbs-5')).map((entry) => entry.id)).toEqual(['wbs-5']);
  });

  it('throws on a cycle instead of looping forever', () => {
    const cyclic = indexItems([item('wbs-6', 'prj-1', 'wbs-7'), item('wbs-7', 'prj-1', 'wbs-6')]);
    expect(() => trailOf(cyclic, wbs('wbs-6'))).toThrow(RangeError);
  });
});
