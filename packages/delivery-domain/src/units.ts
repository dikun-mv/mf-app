// Branded units (T1.1): a number can't be passed as the wrong unit by accident. Each brand is
// applied in exactly one place, its constructor below.

declare const unitBrand: unique symbol;
type Unit<B extends string> = number & { readonly [unitBrand]: B };

/** The canonical allocation unit (D3). One person-month is the person's hours for that month. */
export type PersonMonths = Unit<'PersonMonths'>;
export type Hours = Unit<'Hours'>;
/** An amount in EUR. Rates are stored in EUR; the display currency is applied at the edge (D11). */
export type Money = Unit<'Money'>;
/** A percentage of capacity, 100 = exactly one person-month. */
export type Percent = Unit<'Percent'>;
/** EUR per hour. */
export type Rate = Unit<'Rate'>;

export const personMonths = (value: number): PersonMonths => value as PersonMonths;
export const hours = (value: number): Hours => value as Hours;
export const money = (value: number): Money => value as Money;
export const percent = (value: number): Percent => value as Percent;
export const rate = (value: number): Rate => value as Rate;

/** The four units the grid reads and edits in. */
export const DISPLAY_UNITS = ['hours', 'personMonths', 'percent', 'cost'] as const;
export type DisplayUnit = (typeof DISPLAY_UNITS)[number];

/** Decimal places shown per unit (brief §3.5). The display step is 10^-decimals. */
export const DISPLAY_DECIMALS = {
  hours: 2,
  personMonths: 2,
  percent: 1,
  cost: 2,
} as const satisfies Record<DisplayUnit, number>;

/** Decimal places of a displayed hourly rate (brief §3.4: €89.5455/h). */
export const RATE_DECIMALS = 4;
