import type { Currency, Month } from '@baseline/host-contract';
import type { WeeklyHours } from '@baseline/people-contract';
import { workingDaysIn } from './calendar';
import { at } from './lookup';
import { formatDate, formatDayMonth, formatMonth, formatRate, formatUnit } from './format';
import type { CellDetails, CellMarker, PersonMonthDetails, PricingDetails, RateSliceDetails } from './gridViewTypes';
import { MARKER_SYMBOLS } from './gridViewTypes';
import {
  type CellPricing,
  WORKING_DAYS_PER_WEEK,
  blendedRate,
  cellPricing,
  hoursFromPersonMonths,
  personMonthHours,
  valueInUnit,
} from './pricing';
import { type RateInput, sliceMonth } from './rates';
import { roundValue } from './rounding';
import { type DisplayUnit, personMonths } from './units';

// The words of the staffing grid's markers and of its cell details panel (T6.9, T6.12). They are
// built here, from the same numbers the grid shows, so a test can pin them without React.

/** An employee as the details need them: People's weekly hours and rates for one person. */
export interface EmployeeData {
  readonly name: string;
  readonly weeklyHours: WeeklyHours;
  readonly rates: readonly RateInput[];
}

// ---- How a month is priced for one employee (D17) ----

export type MonthPricing =
  | { readonly pricing: Extract<CellPricing, { kind: 'priced' }>; readonly note: null }
  /** `note` is why the month isn't fully costed, as a sentence. */
  | { readonly pricing: Exclude<CellPricing, { kind: 'priced' }>; readonly note: string };

export function monthPricing(month: Month, rates: readonly RateInput[]): MonthPricing {
  const pricing = cellPricing(month, rates);
  switch (pricing.kind) {
    case 'priced':
      return { pricing, note: null };
    case 'partiallyPriced':
      return {
        pricing,
        note: `${String(pricing.unpricedWorkingDays)} of ${String(pricing.workingDays)} working days are before the first rate (${formatDate(pricing.firstRateFrom)}) and aren't costed.`,
      };
    case 'unpriced': {
      const [firstRate] = rates.map((rate) => rate.validFrom).sort();
      const days = String(workingDaysIn(month));
      return {
        pricing,
        note:
          firstRate === undefined
            ? `No rate is recorded, so none of the ${days} working days is costed.`
            : `The month is before the first rate (${formatDate(firstRate)}), so none of its ${days} working days is costed.`,
      };
    }
  }
}

const marker = (kind: CellMarker['kind'], text: string): CellMarker => ({ kind, symbol: MARKER_SYMBOLS[kind], text });

/** The marker for a partly or wholly unpriced month, or null when it is fully priced. */
export function pricingMarker(monthly: MonthPricing): CellMarker | null {
  return monthly.note === null ? null : marker(monthly.pricing.kind, monthly.note);
}

/** The inline reason a cost edit is refused in this month (D17, screens 3.3), or null when it is allowed. */
export function euroEditRefusal({ note }: MonthPricing): string | null {
  return note === null
    ? null
    : `Can't edit the cost here: ${note} Switch to Hours, Person-months or % to edit this cell.`;
}

// ---- Over capacity (D18) ----

export interface OverCapacityFacts {
  readonly employeeName: string;
  readonly month: Month;
  /** The person's allocations that month across every project, in person-months. */
  readonly allocatedPersonMonths: number;
  /** The most recently edited contributing allocation: where it sits and how much it holds (D18). */
  readonly causer: { readonly path: string; readonly amount: number };
}

const personMonthsText = (value: number): string => formatUnit(roundValue(value, 'personMonths'), 'personMonths');

/** `†`, with the month's load and the assignment that caused it, which may be in another project. */
export function overCapacityMarker(facts: OverCapacityFacts): CellMarker {
  const percent = formatUnit(roundValue(facts.allocatedPersonMonths * 100, 'percent'), 'percent');
  const load = `Over capacity: ${facts.employeeName}, ${formatMonth(facts.month)} — ${percent} of capacity (${personMonthsText(facts.allocatedPersonMonths)} PM) across all projects.`;
  const cause = ` Caused by: ${facts.causer.path}, ${personMonthsText(facts.causer.amount)} PM, the most recently edited contributing allocation.`;
  return marker('overCapacity', load + cause);
}

// ---- The details panel ----

export interface DetailsInput {
  readonly title: string;
  readonly month: Month;
  /** The cell's stored person-months. */
  readonly personMonths: number;
  /** The unit the grid shows, and the cell's value in it after `roundGrid`: details agree with the grid. */
  readonly unit: DisplayUnit;
  readonly steps: number;
  /** Null without People's data. */
  readonly employee: EmployeeData | null;
  readonly currency: Currency;
  readonly markers: readonly CellMarker[];
}

const hoursText = (value: number): string => formatUnit(roundValue(value, 'hours'), 'hours');

function personMonthDetails(input: DetailsInput, employee: EmployeeData): PersonMonthDetails {
  const workingDays = workingDaysIn(input.month);
  const hoursPerPersonMonth = personMonthHours(employee.weeklyHours, input.month);
  const effort = hoursFromPersonMonths(personMonths(input.personMonths), employee.weeklyHours, input.month);
  const hoursPerWorkingDay = effort / workingDays;
  const perMonth = `${hoursText(hoursPerPersonMonth)} h (${String(employee.weeklyHours)} h/week × ${String(workingDays)} working days ÷ ${String(WORKING_DAYS_PER_WEEK)})`;
  return {
    weeklyHours: employee.weeklyHours,
    workingDays,
    hoursPerPersonMonth,
    hoursPerWorkingDay,
    text: `Person-month ${perMonth} · ${hoursText(hoursPerWorkingDay)} h per working day`,
  };
}

function pricingDetails(input: DetailsInput, employee: EmployeeData): PricingDetails {
  const { perEur, code } = input.currency;
  // A slice with no working day (a rate starting on a weekend) says nothing to the reader.
  const slices = sliceMonth(input.month, employee.rates).filter((slice) => slice.workingDays > 0);
  const priced = (hourlyCost: number | null): number | null => (hourlyCost === null ? null : hourlyCost * perEur);

  const details: RateSliceDetails[] = slices.map((slice) => ({
    from: slice.from,
    workingDays: slice.workingDays,
    hourlyCost: priced(slice.hourlyCost),
  }));
  const rateOf = ({ hourlyCost }: RateSliceDetails): string =>
    hourlyCost === null ? 'not costed' : `at ${formatRate(hourlyCost, code, 2)}`;

  const total = details.reduce((sum, slice) => sum + slice.workingDays, 0);
  const slicesText =
    details.length === 1
      ? `${String(total)} working days ${rateOf(at(details, 0))}`
      : `${String(total)} working days: ${details
          .map((slice, position) => {
            const when =
              position === 0 ? `before ${formatDayMonth(at(details, 1).from)}` : `from ${formatDayMonth(slice.from)}`;
            return `${String(slice.workingDays)} ${when} ${rateOf(slice)}`;
          })
          .join(', ')}`;

  const blended = priced(blendedRate(input.month, employee.rates));
  return {
    slices: details,
    blendedRate: blended,
    slicesText,
    blendedRateText:
      blended === null
        ? 'No blended rate: no working day of this month is costed'
        : `Blended rate ${formatRate(blended, code)}`,
  };
}

/** The cell's value in each of the four units, written out the way the details panel reads them. */
export function cellDetails(input: DetailsInput): CellDetails {
  const { employee, unit, steps, currency } = input;
  const pm = input.personMonths;

  // The displayed unit uses the grid's own rounded number; the others round the cell by itself.
  const textOf = (target: DisplayUnit, exact: number): string =>
    formatUnit(target === unit ? steps : roundValue(exact, target), target, currency.code);
  const context =
    employee === null ? null : { weeklyHours: employee.weeklyHours, month: input.month, rates: employee.rates };
  const valueIn = (target: 'hours' | 'cost'): number | null =>
    context === null ? null : valueInUnit(target, personMonths(pm), context, currency.perEur);

  const hours = valueIn('hours');
  const cost = valueIn('cost');
  const values = {
    personMonths: textOf('personMonths', pm),
    hours: hours === null ? null : textOf('hours', hours),
    percent: textOf('percent', pm * 100),
    cost: cost === null ? null : textOf('cost', cost),
  };
  const conversion = [
    `${values.personMonths} PM`,
    ...(values.hours === null ? [] : [`${values.hours} h`]),
    `${values.percent} of capacity`,
    ...(values.cost === null ? [] : [values.cost]),
  ].join(' = ');

  return {
    title: input.title,
    conversion,
    values,
    personMonth: employee === null ? null : personMonthDetails(input, employee),
    pricing: employee === null ? null : pricingDetails(input, employee),
    markers: input.markers,
  };
}
