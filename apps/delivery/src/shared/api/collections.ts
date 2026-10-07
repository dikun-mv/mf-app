import type { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import { PEOPLE_COLLECTIONS, type Employee, type RateRecord } from '@baseline/people-contract';

/** The two PocketBase instances Delivery reads. It writes only to its own (D6, D16). */
export type Instance = 'delivery' | 'people';

/** The shape of a record once parsed, by collection. The cache holds these and nothing derived (D26). */
export interface RecordTypes {
  readonly projects: Project;
  readonly breakdownItems: BreakdownItem;
  readonly allocations: Allocation;
  readonly employees: Employee;
  readonly rateRecords: RateRecord;
}

export type CollectionKey = keyof RecordTypes;
export type RecordOf<K extends CollectionKey> = RecordTypes[K];

/**
 * Where each collection lives: its instance and its PocketBase name, which is also its realtime topic.
 * People's two names come from `people-contract`; Delivery's three are private, so they are written here. Employees and rates are People's, read-only for Delivery (D16).
 */
export const COLLECTIONS = {
  projects: { instance: 'delivery', name: 'projects' },
  breakdownItems: { instance: 'delivery', name: 'breakdown_items' },
  allocations: { instance: 'delivery', name: 'allocations' },
  employees: { instance: 'people', name: PEOPLE_COLLECTIONS.employees },
  rateRecords: { instance: 'people', name: PEOPLE_COLLECTIONS.rateRecords },
} as const satisfies Record<CollectionKey, { readonly instance: Instance; readonly name: string }>;

/** The collections of one instance: what its `RealtimeProvider` subscribes to. */
export function collectionsOf(instance: Instance): readonly CollectionKey[] {
  // `Object.keys` loses the key type; every key of COLLECTIONS is a CollectionKey by construction.
  return (Object.keys(COLLECTIONS) as CollectionKey[]).filter((key) => COLLECTIONS[key].instance === instance);
}
