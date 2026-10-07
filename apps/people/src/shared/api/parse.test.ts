import { describe, expect, it, rs } from '@rstest/core';
import { parseRecordEvent } from './parse';

const rateRecord = {
  collectionName: 'rate_records',
  collectionId: 'c2',
  id: 'rate-12',
  employeeId: 'emp-001',
  validFrom: '2026-03-12',
  hourlyCost: 95,
};

describe('parseRecordEvent', () => {
  it('parses the record of an event with its contract schema', () => {
    expect(parseRecordEvent('rateRecords', { action: 'update', record: rateRecord })).toEqual({
      collection: 'rateRecords',
      action: 'update',
      record: { id: 'rate-12', employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 },
    });
  });

  it('parses a load row, mapping the empty causer to null', () => {
    const event = parseRecordEvent('employeeMonthLoads', {
      action: 'create',
      record: {
        collectionName: 'employee_month_loads',
        id: 'emp-001-2026-03',
        employeeId: 'emp-001',
        month: '2026-03',
        allocatedPersonMonths: 0.5,
        overCapacity: false,
        causingAllocationId: '',
      },
    });
    expect(event).toMatchObject({ collection: 'employeeMonthLoads', record: { causingAllocationId: null } });
  });

  it.each([
    ['a record of another collection', 'employees', { action: 'create', record: rateRecord }],
    ['a record that fails its schema', 'rateRecords', { action: 'create', record: { ...rateRecord, hourlyCost: -1 } }],
    ['an unknown action', 'rateRecords', { action: 'upsert', record: rateRecord }],
    ['a message that is not an event', 'rateRecords', {}],
  ] as const)('drops %s, and logs it instead of caching it', (_name, collection, message) => {
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseRecordEvent(collection, message)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
