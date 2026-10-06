import { AllocationId, BreakdownItemId } from '@baseline/delivery-contract';

// New records get `<prefix>-<uuid>` ids made by the client, so an optimistic change set can refer
// to a record before the server confirms it (T1.1). Seed ids stay as they are.

const randomUuid = (): string => crypto.randomUUID();

export const newBreakdownItemId = (uuid: () => string = randomUuid): BreakdownItemId =>
  BreakdownItemId.parse(`wbs-${uuid()}`);

export const newAllocationId = (uuid: () => string = randomUuid): AllocationId => AllocationId.parse(`alloc-${uuid()}`);
