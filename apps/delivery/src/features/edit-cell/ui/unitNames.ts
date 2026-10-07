import type { DisplayUnit } from '@baseline/delivery-domain';

/** How each unit reads in a cell's accessible name. */
export const UNIT_NAMES: Record<DisplayUnit, string> = {
  hours: 'hours',
  personMonths: 'person-months',
  percent: '% of capacity',
  cost: 'cost',
};
