import {
  DISPLAY_DECIMALS,
  parseAmount,
  personMonths,
  personMonthsFromPercent,
  personMonthsFromValue,
  percent,
  type AmountError,
  type DisplayUnit,
  type EmployeeMonth,
  type PersonCellView,
  type PersonMonths,
} from '@baseline/delivery-domain';

// What happens when the user finishes typing in a cell (T6.6, D17, D34, D37): a pure decision, so the
// component only acts on it. The numbers themselves come from `delivery-domain`; this routes the text there.

/** The part of a cell's view an edit needs. */
type EditedCell = Pick<
  PersonCellView,
  'allocationId' | 'exact' | 'text' | 'month' | 'personMonths' | 'euroEditRefusal'
>;

/** What People holds for the employee of the row, which hours and cost edits need. Null while it isn't known. */
export type EmployeeRates = Pick<EmployeeMonth, 'weeklyHours' | 'rates'>;

export interface EditInput {
  readonly draft: string;
  /** Whether the user has changed the input since the editor opened. An untouched draft is never saved. */
  readonly touched: boolean;
  readonly unit: DisplayUnit;
  /** The cell as it is now, not as it was when the editor opened: realtime may have changed it (D37). */
  readonly cell: EditedCell;
  readonly employee: EmployeeRates | null;
  /** Display currency units per EUR (D11). */
  readonly perEur: number;
}

export type EditOutcome =
  /** Nothing to write: the draft is the value the editor opened with, or equals what is stored (T6.6). */
  | { readonly kind: 'unchanged' }
  /** The draft can't be saved; the editor stays open and says why, next to the cell (D33). */
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'save'; readonly amount: PersonMonths };

/** The text the editor opens with: the cell's value in its unit, without symbol or grouping; empty where nothing is stored. */
export function openingText(unit: DisplayUnit, cell: Pick<PersonCellView, 'allocationId' | 'exact'>): string {
  return cell.allocationId === null ? '' : cell.exact.toFixed(DISPLAY_DECIMALS[unit]);
}

const AMOUNT_PROBLEMS: Record<AmountError, string> = {
  empty: 'Enter an amount, or press Esc to cancel.',
  notANumber: 'Enter a number such as 0.5 (use . for decimals).',
  negative: "The amount can't be negative.",
};

/** Relative size below which two values in a unit are the same number. */
const NOISE = 1e-9;

const COST_REFUSED = "Can't edit the cost here. Switch to Hours, Person-months or % to edit this cell.";
const NEEDS_PEOPLE = "Hours and cost need People's data, which can't be reached. Switch to Person-months or %.";

/**
 * Decides what to do with a finished draft. An untouched draft is unchanged, however the cell moved under
 * it meanwhile: a value changed elsewhere isn't overwritten by a draft nobody edited (D37). A touched draft
 * is compared only with what is stored at this moment, which is what D37 means by comparing at save time:
 * it is unchanged when it is the text or number the cell shows now (so a cell shown rounded isn't rewritten
 * with its rounding) or the stored number. Typing the old text back over a remote change is a real edit.
 * A € edit in a partly priced or unpriced month is refused with the cell's own reason (D17).
 */
export function resolveEdit({ draft, touched, unit, cell, employee, perEur }: EditInput): EditOutcome {
  if (!touched || draft.trim() === openingText(unit, cell)) return { kind: 'unchanged' };
  const parsed = parseAmount(draft);
  if (!parsed.ok) return { kind: 'rejected', message: AMOUNT_PROBLEMS[parsed.error] };
  // The number the cell shows is no edit either. Grid rounding can move a cell a step from its exact value
  // so that rows and columns add up (0.3333 shown as 0.34), and typing back what was seen changes nothing.
  const shown = parseAmount(cell.text);
  if (shown.ok && parsed.value === shown.value) return { kind: 'unchanged' };
  // Compared with what is stored now, in the unit it was typed in: the exact value `cell.exact`, to within float noise (7880 typed back over a cost of 7880.0000000001 is no edit).
  if (Math.abs(parsed.value - cell.exact) <= NOISE * Math.max(1, Math.abs(cell.exact))) return { kind: 'unchanged' };

  let amount: PersonMonths;
  if (unit === 'personMonths') amount = personMonths(parsed.value);
  else if (unit === 'percent') amount = personMonthsFromPercent(percent(parsed.value));
  else {
    if (unit === 'cost' && cell.euroEditRefusal !== null) return { kind: 'rejected', message: cell.euroEditRefusal };
    if (employee === null) return { kind: 'rejected', message: NEEDS_PEOPLE };
    const converted = personMonthsFromValue(unit, parsed.value, { ...employee, month: cell.month }, perEur);
    if (!converted.ok) return { kind: 'rejected', message: cell.euroEditRefusal ?? COST_REFUSED };
    amount = converted.value;
  }
  // A cell with nothing stored already reads as zero.
  const stored = cell.allocationId === null ? 0 : cell.personMonths;
  return amount === stored ? { kind: 'unchanged' } : { kind: 'save', amount };
}
