import { formatMonth, type OverCapacityMonth } from '@baseline/people-domain';

/** The register's badge: the months, as `Over capacity · Jun 2026, Jul 2026` (screens 2.1). */
export const overCapacityMonthsLabel = (months: readonly OverCapacityMonth[]): string =>
  `Over capacity · ${months.map(({ month }) => formatMonth(month)).join(', ')}`;

/** The employee page's badge: how many months, as `Over capacity · 1 month` (screens 2.6). */
export const overCapacityCountLabel = (months: readonly OverCapacityMonth[]): string =>
  `Over capacity · ${String(months.length)} ${months.length === 1 ? 'month' : 'months'}`;
