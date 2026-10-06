import { BreakdownItemId, ProjectId } from '@baseline/delivery-contract';
import { IsoDateTime, Month } from '@baseline/host-contract';
import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import fc from 'fast-check';
import { removeAllocation, upsertAllocation } from './allocations';
import { type ChangeSet, type PlanState, applyChangeSet } from './changeSet';
import { newAllocationId, newBreakdownItemId } from './ids';
import { checkInvariants } from './invariants';
import { monthsBetween } from './calendar';
import { monthOf } from './calendar';
import { createItem, deleteItem, indexItems, isLeaf, moveItem, renameItem } from './tree';
import type { Result } from './result';
import type { DomainError } from './errors';
import { seedPlan } from './testing/seed';

// A random sequence of edits applied to the real seed must keep the plan valid, and must never
// lose an allocation except by an explicit delete (brief §3.8: "silent loss is not fine").

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 60) };

const operation = fc.record({
  kind: fc.constantFrom('create', 'rename', 'move', 'delete', 'upsert', 'remove'),
  a: fc.nat({ max: 10_000 }),
  b: fc.nat({ max: 10_000 }),
  c: fc.nat({ max: 10_000 }),
});

let uuidCounter = 0;
const uuid = (): string => {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
};

const total = (state: PlanState): number => state.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
const pick = <T>(list: readonly T[], at: number): T | undefined =>
  list.length === 0 ? undefined : list[at % list.length];

describe('plan edits', () => {
  it('keep the plan valid and lose an allocation only through a delete', () => {
    fc.assert(
      fc.property(fc.array(operation, { minLength: 1, maxLength: 25 }), (operations) => {
        let state = seedPlan();
        let now = 0;
        for (const op of operations) {
          const index = indexItems(state.items);
          const item = pick(state.items, op.a);
          const other = pick(state.items, op.b);
          now += 1;
          let result: Result<ChangeSet, DomainError> | undefined;

          switch (op.kind) {
            case 'create':
              result = createItem(state, {
                id: newBreakdownItemId(uuid),
                projectId: item?.projectId ?? ProjectId.parse('prj-1'),
                parentId: op.c % 4 === 0 ? null : (item?.id ?? null),
                name: `New ${String(op.c)}`,
              });
              break;
            case 'rename':
              result = item === undefined ? undefined : renameItem(state, item.id, `Renamed ${String(op.c)}`);
              break;
            case 'move':
              result =
                item === undefined ? undefined : moveItem(state, item.id, op.c % 5 === 0 ? null : (other?.id ?? null));
              break;
            case 'delete':
              result = item === undefined ? undefined : deleteItem(state, item.id);
              break;
            case 'upsert': {
              const leaves = state.items.filter((candidate) => isLeaf(index, candidate.id));
              const leaf = pick(leaves, op.a);
              const project = state.projects.find((candidate) => candidate.id === leaf?.projectId);
              if (leaf === undefined || project === undefined) break;
              const months = monthsBetween(monthOf(project.startDate), monthOf(project.endDate));
              result = upsertAllocation(
                state,
                {
                  id: newAllocationId(uuid),
                  breakdownItemId: leaf.id,
                  employeeId: EmployeeId.parse(`emp-${String((op.b % 60) + 1).padStart(3, '0')}`),
                  month: pick(months, op.c) ?? Month.parse('2026-03'),
                  amount: (op.c % 70) / 100,
                },
                IsoDateTime.parse(new Date(Date.UTC(2026, 9, 6, 12, 0, 0, now)).toISOString()),
              );
              break;
            }
            case 'remove': {
              const victim = pick(state.allocations, op.a);
              result = victim === undefined ? undefined : removeAllocation(state, victim.id);
              break;
            }
          }
          if (result === undefined || !result.ok) continue; // Refusals leave the state alone.

          const before = state;
          const beforeIds = new Set<string>(before.allocations.map((a) => a.id));
          state = applyChangeSet(state, result.value);

          expect(checkInvariants(state)).toEqual([]);

          const afterIds = new Set<string>(state.allocations.map((a) => a.id));
          const deleted = new Set<string>(result.value.delete.allocationIds);
          const created = new Set<string>(result.value.create.allocations.map((a) => a.id));
          // Exactly the deleted ids disappear and exactly the created ids appear.
          expect([...beforeIds].filter((id) => !afterIds.has(id)).sort()).toEqual([...deleted].sort());
          expect([...afterIds].filter((id) => !beforeIds.has(id)).sort()).toEqual([...created].sort());

          // Nothing is lost unless deleted: the total changes by exactly what the change set says.
          const amountBefore = new Map(before.allocations.map((a) => [a.id, a.amount]));
          const expectedTotal =
            total(before) -
            before.allocations.filter((a) => deleted.has(a.id)).reduce((sum, a) => sum + a.amount, 0) +
            result.value.create.allocations.reduce((sum, a) => sum + a.amount, 0) +
            result.value.update.allocations.reduce((sum, a) => sum + a.amount - (amountBefore.get(a.id) ?? 0), 0);
          expect(total(state)).toBeCloseTo(expectedTotal, 9);

          // Creating, renaming and moving items never changes the effort planned (D9, brief §3.8).
          const isTreeOperation = op.kind === 'create' || op.kind === 'move' || op.kind === 'rename';
          expect(isTreeOperation ? total(state) - total(before) : 0).toBeCloseTo(0, 9);

          // Allocations that a tree operation moves keep their edit time (D18).
          const editTimesChanged = result.value.update.allocations.filter(
            (a) => a.editedAt !== before.allocations.find((other) => other.id === a.id)?.editedAt,
          );
          expect(isTreeOperation ? editTimesChanged.length : 0).toBe(0);
        }
        expect(BreakdownItemId.safeParse(newBreakdownItemId(uuid)).success).toBe(true);
      }),
      RUNS,
    );
  });
});
