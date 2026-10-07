import type { IsoDate, Month } from '@baseline/host-contract';
import type { WeeklyHours } from '@baseline/people-contract';
import { workingDaysIn } from './calendar';
import { assertNever } from './never';
import { type RateInput, sliceMonth } from './rates';
import { type Result, err, ok } from './result';
import {
  type DisplayUnit,
  type Hours,
  type Money,
  type Percent,
  type PersonMonths,
  type Rate,
  hours,
  money,
  percent,
  personMonths,
  rate,
} from './units';

/** A person-month is weekly hours × (working days ÷ this). */
export const WORKING_DAYS_PER_WEEK = 5;

/** One employee in one month: the inputs every conversion between the four units needs. */
export interface EmployeeMonth {
  readonly weeklyHours: WeeklyHours;
  readonly month: Month;
  readonly rates: readonly RateInput[];
}

// ---- Person-month and the units that depend only on capacity ----

/** One person-month in hours: weekly hours × (working days ÷ 5). Varies by person and month. */
export const personMonthHours = (weeklyHours: WeeklyHours, month: Month): Hours =>
  hours((weeklyHours * workingDaysIn(month)) / WORKING_DAYS_PER_WEEK);

export const hoursFromPersonMonths = (pm: PersonMonths, weeklyHours: WeeklyHours, month: Month): Hours =>
  hours(pm * personMonthHours(weeklyHours, month));

export const personMonthsFromHours = (value: Hours, weeklyHours: WeeklyHours, month: Month): PersonMonths =>
  personMonths(value / personMonthHours(weeklyHours, month));

/** 100% is exactly one person-month, so this holds for every person and month. */
export const percentFromPersonMonths = (pm: PersonMonths): Percent => percent(pm * 100);

export const personMonthsFromPercent = (value: Percent): PersonMonths => personMonths(value / 100);

// ---- Pricing ----

interface MonthAnalysis {
  readonly workingDays: number;
  readonly pricedWorkingDays: number;
  /** Σ working days × hourly cost over the priced slices. */
  readonly pricedWeight: number;
  /** Start of the first priced slice, which is the first rate's `validFrom` when it falls in the month. */
  readonly firstPricedFrom: IsoDate | null;
}

function analyse(month: Month, rates: readonly RateInput[]): MonthAnalysis {
  const slices = sliceMonth(month, rates);
  let workingDays = 0;
  let pricedWorkingDays = 0;
  let pricedWeight = 0;
  let firstPricedFrom: IsoDate | null = null;
  for (const slice of slices) {
    workingDays += slice.workingDays;
    if (slice.hourlyCost !== null) {
      firstPricedFrom ??= slice.from;
      pricedWorkingDays += slice.workingDays;
      pricedWeight += slice.workingDays * slice.hourlyCost;
    }
  }
  return { workingDays, pricedWorkingDays, pricedWeight, firstPricedFrom };
}

/**
 * The displayed rate: Σ(working days × rate) ÷ Σ working days, over the priced days only. It is
 * defined even for an empty cell, and null only when no working day of the month is priced.
 */
export function blendedRate(month: Month, rates: readonly RateInput[]): Rate | null {
  const { pricedWorkingDays, pricedWeight } = analyse(month, rates);
  return pricedWorkingDays === 0 ? null : rate(pricedWeight / pricedWorkingDays);
}

/**
 * Cost of a cell in EUR. The effort is spread evenly over the month's working days, each day is
 * costed at its slice's rate, and days before the first rate cost 0 (D17).
 */
export function cellCost(pm: PersonMonths, { weeklyHours, month, rates }: EmployeeMonth): Money {
  const effort = hoursFromPersonMonths(pm, weeklyHours, month);
  const { workingDays, pricedWeight } = analyse(month, rates);
  return money((effort * pricedWeight) / workingDays);
}

// ---- Cell state ----

export type CellPricing =
  | { readonly kind: 'priced' }
  /** The first rate starts inside the month. The days before it cost 0 (D17). */
  | {
      readonly kind: 'partiallyPriced';
      readonly workingDays: number;
      readonly unpricedWorkingDays: number;
      readonly firstRateFrom: IsoDate;
    }
  /** The whole month is before the first rate, so it costs 0. */
  | { readonly kind: 'unpriced' };

/** What the UI draws a cell from: how it is priced, and whether its person-month is over capacity. */
export type CellState = CellPricing & { readonly overCapacity: boolean };

export function cellPricing(month: Month, rates: readonly RateInput[]): CellPricing {
  const { workingDays, pricedWorkingDays, firstPricedFrom } = analyse(month, rates);
  if (pricedWorkingDays === workingDays) return { kind: 'priced' };
  if (pricedWorkingDays === 0 || firstPricedFrom === null) return { kind: 'unpriced' };
  return {
    kind: 'partiallyPriced',
    workingDays,
    unpricedWorkingDays: workingDays - pricedWorkingDays,
    firstRateFrom: firstPricedFrom,
  };
}

export const cellState = (month: Month, rates: readonly RateInput[], overCapacity: boolean): CellState => ({
  ...cellPricing(month, rates),
  overCapacity,
});

// ---- Editing in €, and the other units ----

/** Why a € edit can't be turned into effort. */
export type EuroEditError = 'unpriced' | 'partiallyPriced';
export type EditError = EuroEditError | 'notANumber';

/**
 * The rate a € edit is divided by. The one place that decides which months accept a € edit: a fully
 * priced month uses its blended rate; unpriced and partially priced months are refused (D17).
 */
export function euroEditRate(month: Month, rates: readonly RateInput[]): Result<Rate, EuroEditError> {
  const { workingDays, pricedWorkingDays, pricedWeight } = analyse(month, rates);
  if (pricedWorkingDays === 0) return err('unpriced');
  if (pricedWorkingDays < workingDays) return err('partiallyPriced');
  return ok(rate(pricedWeight / pricedWorkingDays));
}

/**
 * The exact value of a stored allocation in a display unit. Cost is in the display currency
 * (`perEur` is the shell's rate from EUR), converted before any rounding (D11, T1.8).
 */
export function valueInUnit(unit: DisplayUnit, pm: PersonMonths, context: EmployeeMonth, perEur: number): number {
  switch (unit) {
    case 'hours':
      return hoursFromPersonMonths(pm, context.weeklyHours, context.month);
    case 'personMonths':
      return pm;
    case 'percent':
      return percentFromPersonMonths(pm);
    case 'cost':
      return cellCost(pm, context) * perEur;
    default:
      return assertNever(unit);
  }
}

/**
 * The inverse of `valueInUnit`: what the user typed, back to the stored person-months. A cost is
 * converted from the display currency to EUR, divided by the blended rate to get hours, and the
 * hours converted to person-months.
 */
export function personMonthsFromValue(
  unit: DisplayUnit,
  value: number,
  context: EmployeeMonth,
  perEur: number,
): Result<PersonMonths, EditError> {
  if (!Number.isFinite(value)) return err('notANumber');
  switch (unit) {
    case 'hours':
      return ok(personMonthsFromHours(hours(value), context.weeklyHours, context.month));
    case 'personMonths':
      return ok(personMonths(value));
    case 'percent':
      return ok(personMonthsFromPercent(percent(value)));
    case 'cost': {
      const blended = euroEditRate(context.month, context.rates);
      if (!blended.ok) return blended;
      return ok(personMonthsFromHours(hours(value / perEur / blended.value), context.weeklyHours, context.month));
    }
    default:
      return assertNever(unit);
  }
}
