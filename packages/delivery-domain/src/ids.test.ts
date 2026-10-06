import { AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { newAllocationId, newBreakdownItemId } from './ids';

describe('new ids (T1.1)', () => {
  it('make <prefix>-<uuid> ids that parse, from the platform’s uuid by default', () => {
    expect(BreakdownItemId.safeParse(newBreakdownItemId()).success).toBe(true);
    expect(AllocationId.safeParse(newAllocationId()).success).toBe(true);
    expect(newBreakdownItemId()).not.toBe(newBreakdownItemId());
  });

  it('can be given a uuid source for tests', () => {
    const uuid = () => '00000000-0000-4000-8000-000000000001';
    expect(newBreakdownItemId(uuid)).toBe('wbs-00000000-0000-4000-8000-000000000001');
    expect(newAllocationId(uuid)).toBe('alloc-00000000-0000-4000-8000-000000000001');
  });
});
