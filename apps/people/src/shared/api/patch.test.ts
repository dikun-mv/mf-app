import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import { IsoDate, Month } from '@baseline/host-contract';
import { EmployeeId, RateRecordId, type Employee, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { patchCollection, patchList } from './patch';
import { createQueryClient } from './queryClient';
import { employeeKeys, employeeMonthLoadKeys, rateRecordKeys } from './queryKeys';

const employee = (n: number, name: string): Employee => ({
  id: EmployeeId.parse(`emp-${String(n).padStart(3, '0')}`),
  name,
  role: 'Tech Lead',
  weeklyHours: 40,
});
const rate = (n: number, validFrom: string, hourlyCost: number): RateRecord => ({
  id: RateRecordId.parse(`rate-${String(n)}`),
  employeeId: EmployeeId.parse('emp-001'),
  validFrom: IsoDate.parse(validFrom),
  hourlyCost,
});
const load = (employeeId: string, month: string, pm: number): EmployeeMonthLoad => ({
  employeeId: EmployeeId.parse(employeeId),
  month: Month.parse(month),
  allocatedPersonMonths: pm,
  overCapacity: false,
  causingAllocationId: null,
});

describe('patchList', () => {
  const adaeze = employee(1, 'Adaeze Okafor');
  const lena = employee(2, 'Lena Okafor');
  const byId = (e: Employee): string => e.id;

  it('adds a record it has not seen, for a create', () => {
    expect(patchList([adaeze], 'create', lena, byId)).toEqual([adaeze, lena]);
  });

  it('replaces a record by id, for an update, and keeps the others as they were', () => {
    const renamed = { ...lena, name: 'Lena Okafor-Reyes' };
    const patched = patchList([adaeze, lena], 'update', renamed, byId);
    expect(patched).toEqual([adaeze, renamed]);
    expect(patched[0]).toBe(adaeze);
  });

  it('removes a record by id, for a delete', () => {
    expect(patchList([adaeze, lena], 'delete', lena, byId)).toEqual([adaeze]);
  });

  it('returns the same array when the event changes nothing, so the echo of our own write re-renders nothing', () => {
    const list = [adaeze, lena];
    expect(patchList(list, 'update', { ...lena }, byId)).toBe(list);
    expect(patchList(list, 'delete', employee(9, 'Nobody'), byId)).toBe(list);
  });
});

describe('patchCollection', () => {
  it('patches the cached collection of the event', () => {
    const client = createQueryClient();
    client.setQueryData(rateRecordKeys.all, [rate(1, '2025-01-01', 80)]);
    patchCollection(client, { collection: 'rateRecords', action: 'create', record: rate(2, '2026-03-12', 95) });
    patchCollection(client, { collection: 'rateRecords', action: 'update', record: rate(1, '2025-01-01', 82) });
    expect(client.getQueryData(rateRecordKeys.all)).toEqual([rate(1, '2025-01-01', 82), rate(2, '2026-03-12', 95)]);
  });

  it('keys a load row by employee and month, since the parsed row has no id', () => {
    const client = createQueryClient();
    client.setQueryData(employeeMonthLoadKeys.all, [load('emp-001', '2026-03', 0.5), load('emp-001', '2026-04', 0.7)]);
    patchCollection(client, {
      collection: 'employeeMonthLoads',
      action: 'update',
      record: load('emp-001', '2026-04', 1.2),
    });
    patchCollection(client, {
      collection: 'employeeMonthLoads',
      action: 'delete',
      record: load('emp-001', '2026-03', 0.5),
    });
    expect(client.getQueryData(employeeMonthLoadKeys.all)).toEqual([load('emp-001', '2026-04', 1.2)]);
  });

  it('leaves a collection nobody has loaded alone, instead of caching a partial list', () => {
    const client = createQueryClient();
    patchCollection(client, { collection: 'employees', action: 'create', record: employee(1, 'Adaeze Okafor') });
    expect(client.getQueryData(employeeKeys.all)).toBeUndefined();
  });
});
