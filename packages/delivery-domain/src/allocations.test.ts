import { AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import { IsoDateTime, Month } from '@baseline/host-contract';
import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { type AllocationDraft, removeAllocation, upsertAllocation, validateAllocation } from './allocations';
import { applyChangeSet } from './changeSet';
import { allocation, item, plan, project } from './testing/stateBuilders';

const NOW = IsoDateTime.parse('2026-05-01T10:00:00.000Z');

const state = plan({
  projects: [project('prj-1', '2026-03-10', '2026-08-20')],
  items: [item('wbs-1', 'prj-1', null), item('wbs-11', 'prj-1', 'wbs-1'), item('wbs-12', 'prj-1', 'wbs-1')],
  allocations: [allocation('alloc-1', 'wbs-11', 'emp-001', '2026-03', 0.5)],
});

const draft = (overrides: Partial<Record<keyof AllocationDraft, unknown>> = {}): AllocationDraft => ({
  id: AllocationId.parse('alloc-9'),
  breakdownItemId: BreakdownItemId.parse('wbs-12'),
  employeeId: EmployeeId.parse('emp-002'),
  month: Month.parse('2026-04'),
  amount: 0.3,
  ...(overrides as Partial<AllocationDraft>),
});

describe('validateAllocation', () => {
  it('accepts a valid cell', () => {
    expect(validateAllocation(state, draft()).ok).toBe(true);
  });

  it('allows only leaves', () => {
    expect(validateAllocation(state, draft({ breakdownItemId: 'wbs-1' }))).toEqual({
      ok: false,
      error: { code: 'notALeaf', itemId: 'wbs-1' },
    });
    expect(validateAllocation(state, draft({ breakdownItemId: 'wbs-404' }))).toMatchObject({
      ok: false,
      error: { code: 'notFound', entity: 'breakdownItem' },
    });
  });

  it('reports an item whose project is missing', () => {
    const orphan = plan({ ...state, items: [...state.items, item('wbs-77', 'prj-77', null)] });
    expect(validateAllocation(orphan, draft({ breakdownItemId: 'wbs-77' }))).toMatchObject({
      ok: false,
      error: { code: 'notFound', entity: 'project', id: 'prj-77' },
    });
  });

  it('keeps the month inside the project span, by month', () => {
    // The project starts on 10 Mar and ends on 20 Aug: both end months count.
    expect(validateAllocation(state, draft({ month: '2026-03' })).ok).toBe(true);
    expect(validateAllocation(state, draft({ month: '2026-08' })).ok).toBe(true);
    expect(validateAllocation(state, draft({ month: '2026-02' }))).toMatchObject({
      ok: false,
      error: { code: 'monthOutsideProject' },
    });
    expect(validateAllocation(state, draft({ month: '2026-09' }))).toMatchObject({
      ok: false,
      error: { code: 'monthOutsideProject' },
    });
  });

  it('needs an amount of zero or more', () => {
    expect(validateAllocation(state, draft({ amount: 0 })).ok).toBe(true);
    for (const amount of [-0.01, Number.NaN, Infinity]) {
      expect(validateAllocation(state, draft({ amount }))).toMatchObject({
        ok: false,
        error: { code: 'invalidAmount' },
      });
    }
  });

  it('allows one allocation per (item, employee, month)', () => {
    const clash = draft({ id: 'alloc-9', breakdownItemId: 'wbs-11', employeeId: 'emp-001', month: '2026-03' });
    expect(validateAllocation(state, clash)).toEqual({
      ok: false,
      error: { code: 'duplicateAllocation', existingId: 'alloc-1' },
    });
    // The same record being revalidated under its own id is fine.
    expect(validateAllocation(state, { ...clash, id: AllocationId.parse('alloc-1') }).ok).toBe(true);
  });
});

describe('upsertAllocation', () => {
  it('creates a cell and stamps editedAt (D18)', () => {
    const result = upsertAllocation(state, draft(), NOW);
    expect(result.ok && result.value.create.allocations).toEqual([
      { id: 'alloc-9', breakdownItemId: 'wbs-12', employeeId: 'emp-002', month: '2026-04', amount: 0.3, editedAt: NOW },
    ]);
  });

  it('updates an existing cell under its own id and stamps editedAt', () => {
    const result = upsertAllocation(
      state,
      draft({ id: 'alloc-9', breakdownItemId: 'wbs-11', employeeId: 'emp-001', month: '2026-03', amount: 0.7 }),
      NOW,
    );
    expect(result.ok && result.value.update.allocations).toEqual([
      { id: 'alloc-1', breakdownItemId: 'wbs-11', employeeId: 'emp-001', month: '2026-03', amount: 0.7, editedAt: NOW },
    ]);
    expect(result.ok && result.value.create.allocations).toEqual([]);
  });

  it('treats an unchanged amount as no edit, so the causer does not change', () => {
    const result = upsertAllocation(
      state,
      draft({ breakdownItemId: 'wbs-11', employeeId: 'emp-001', month: '2026-03', amount: 0.5 }),
      NOW,
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.value.update.allocations).toEqual([]);
  });

  it('keeps a zero-amount cell as a record, so its person row stays', () => {
    const result = upsertAllocation(state, draft({ amount: 0 }), NOW);
    expect(result.ok && result.value.create.allocations[0]?.amount).toBe(0);
  });

  it('refuses a new cell whose id is taken, and passes validation errors on', () => {
    expect(upsertAllocation(state, draft({ id: 'alloc-1' }), NOW)).toEqual({
      ok: false,
      error: { code: 'duplicateId', id: 'alloc-1' },
    });
    expect(upsertAllocation(state, draft({ amount: -1 }), NOW)).toMatchObject({
      ok: false,
      error: { code: 'invalidAmount' },
    });
  });

  it('round-trips through applyChangeSet', () => {
    const result = upsertAllocation(state, draft(), NOW);
    if (!result.ok) throw new Error('expected ok');
    expect(applyChangeSet(state, result.value).allocations).toHaveLength(2);
  });
});

describe('removeAllocation', () => {
  it('deletes a cell, or says it is missing', () => {
    const removed = removeAllocation(state, AllocationId.parse('alloc-1'));
    expect(removed.ok && removed.value.delete.allocationIds).toEqual(['alloc-1']);
    expect(removeAllocation(state, AllocationId.parse('alloc-404'))).toMatchObject({
      ok: false,
      error: { code: 'notFound' },
    });
  });
});
