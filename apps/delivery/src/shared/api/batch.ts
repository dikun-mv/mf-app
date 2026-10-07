import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import type { ChangeSet } from '@baseline/delivery-domain';

/** The collections Delivery writes: its tree and its allocations. */
export type WriteCollection = 'breakdownItems' | 'allocations';

/** A field value as PocketBase takes it. */
type FieldValue = string | number;

export type BatchOperation =
  | {
      readonly op: 'create' | 'update';
      readonly collection: WriteCollection;
      readonly id: string;
      readonly body: Readonly<Record<string, FieldValue>>;
    }
  | { readonly op: 'delete'; readonly collection: WriteCollection; readonly id: string };

// What is sent for a record. PocketBase has no null, so a root's `parentId` goes as `""` (ADR 033 g).
// `editedAt` is not sent: the `delivery-pb` hook stamps it on create and when `amount` changes, and
// ignores what a client sends (D18, ADR 035).
const itemBody = ({ id, projectId, parentId, name }: BreakdownItem): Record<string, FieldValue> => ({
  id,
  projectId,
  parentId: parentId ?? '',
  name,
});

const allocationBody = ({
  id,
  breakdownItemId,
  employeeId,
  month,
  amount,
}: Allocation): Record<string, FieldValue> => ({
  id,
  breakdownItemId,
  employeeId,
  month,
  amount,
});

/**
 * Items in an order a database can create them: a parent before its children, when both are in the set.
 * A parent that isn't in the set already exists.
 */
function parentFirst(items: readonly BreakdownItem[]): BreakdownItem[] {
  const inSet = new Set<string>(items.map((item) => item.id));
  const placed = new Set<string>();
  const ordered: BreakdownItem[] = [];
  let pending = items;
  while (pending.length > 0) {
    const ready = pending.filter(({ parentId }) => parentId === null || !inSet.has(parentId) || placed.has(parentId));
    // A change set from the domain has no cycles, so this only stops a corrupt one from looping.
    if (ready.length === 0) throw new Error('A change set creates items that are each other’s parents');
    for (const item of ready) {
      ordered.push(item);
      placed.add(item.id);
    }
    pending = pending.filter((item) => !placed.has(item.id));
  }
  return ordered;
}

/**
 * The operations of one batch, in the order the server needs (plan §3, request flow): allocations go
 * before the items they sit on, children before their parents (`delete.itemIds` lists a subtree parent
 * first, so it is reversed), and parents are created before their children. Updates come after creates,
 * since a D9 move re-points allocations at an item created in the same set.
 */
export function batchOperations(changeSet: ChangeSet): BatchOperation[] {
  const { create, update, delete: remove } = changeSet;
  return [
    ...remove.allocationIds.map((id): BatchOperation => ({ op: 'delete', collection: 'allocations', id })),
    ...remove.itemIds.toReversed().map((id): BatchOperation => ({ op: 'delete', collection: 'breakdownItems', id })),
    ...parentFirst(create.items).map((item): BatchOperation => ({
      op: 'create',
      collection: 'breakdownItems',
      id: item.id,
      body: itemBody(item),
    })),
    ...update.items.map((item): BatchOperation => ({
      op: 'update',
      collection: 'breakdownItems',
      id: item.id,
      body: itemBody(item),
    })),
    ...create.allocations.map((allocation): BatchOperation => ({
      op: 'create',
      collection: 'allocations',
      id: allocation.id,
      body: allocationBody(allocation),
    })),
    ...update.allocations.map((allocation): BatchOperation => ({
      op: 'update',
      collection: 'allocations',
      id: allocation.id,
      body: allocationBody(allocation),
    })),
  ];
}
