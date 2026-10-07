import { IsoDate } from '@baseline/host-contract';

/** Today in UTC (D20), the day "Rate today" is read at. Domain functions take the day as a parameter. */
export const today = (): IsoDate => IsoDate.parse(new Date().toISOString().slice(0, 10));
