import { RateRecord } from '@baseline/people-contract';
import { z } from 'zod';
import seed from '../../../../docs/data.json';

// The brief's rate records (docs/data.json), parsed through the contract schema. Test support only.

export const seedRateRecords = z.array(RateRecord).parse(seed.rateRecords);

export const seedRatesOf = (employeeId: string): RateRecord[] =>
  seedRateRecords.filter((record) => record.employeeId === employeeId);

export const seedEmployeeIds = [...new Set(seedRateRecords.map((record) => record.employeeId))];
