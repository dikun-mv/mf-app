import { DISPLAY_DECIMALS, type DisplayUnit } from './units';

// Rounding works in integer display steps (0.01 for hours, PM and €; 0.1 for %), so no step is
// ever a float like 0.1. A value is split into a whole number of steps plus a remainder, and the
// remainder is kept as an integer count of millionths of a step, so sums of remainders are exact.

/** Remainders are kept in millionths of a step. */
export const REMAINDER_SCALE = 1_000_000;

/** A value within this many steps of a whole number is that whole number (float noise, T1.8). */
const SNAP = 1e-6;

export const stepsPerUnit = (decimals: number): number => 10 ** decimals;

/** Steps in one unit of the given display unit: 100 for hours, PM and cost; 10 for %. */
export const stepsOf = (unit: DisplayUnit): number => stepsPerUnit(DISPLAY_DECIMALS[unit]);

export interface SplitSteps {
  /** Whole steps. */
  readonly whole: number;
  /** The rest, in millionths of a step: an integer in `[0, REMAINDER_SCALE)`. */
  readonly remainder: number;
}

/** Splits a value given in steps, snapping float noise first so a typed 0.33 stays 0.33. */
export function splitSteps(steps: number): SplitSteps {
  const nearest = Math.round(steps);
  if (Math.abs(steps - nearest) < SNAP) return { whole: nearest, remainder: 0 };
  // Here the value is at least SNAP from both neighbouring whole numbers, so the remainder is
  // in [1, REMAINDER_SCALE - 1] after rounding, never a whole step.
  const whole = Math.floor(steps);
  return { whole, remainder: Math.round((steps - whole) * REMAINDER_SCALE) };
}

/** Rounds half up on the snapped value: the rule for a total that has no cells to decide it. */
export function roundSteps(steps: number): number {
  const { whole, remainder } = splitSteps(steps);
  return remainder * 2 >= REMAINDER_SCALE ? whole + 1 : whole;
}

/**
 * Largest-remainder rounding in whole steps (brief §3.7). Every value goes down to a whole step,
 * then the steps still owed to reach the rounded total go to the largest remainders, the earlier
 * cell winning a tie. `targetSteps` defaults to the rounded exact sum, and must be reachable.
 */
export function largestRemainderSteps(values: readonly number[], targetSteps?: number): number[] {
  const parts = values.map(splitSteps);
  const wholeTotal = parts.reduce((sum, part) => sum + part.whole, 0);
  const remainderTotal = parts.reduce((sum, part) => sum + part.remainder, 0);
  const target =
    targetSteps === undefined
      ? wholeTotal +
        Math.floor(remainderTotal / REMAINDER_SCALE) +
        ((remainderTotal % REMAINDER_SCALE) * 2 >= REMAINDER_SCALE ? 1 : 0)
      : roundSteps(targetSteps);

  const candidates = parts.flatMap((part, index) => (part.remainder > 0 ? [{ index, remainder: part.remainder }] : []));
  const owed = target - wholeTotal;
  if (owed < 0 || owed > candidates.length) {
    throw new RangeError(
      `A total of ${String(target)} steps can't be reached from these ${String(values.length)} values`,
    );
  }

  const roundedUp = new Set(
    candidates
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, owed)
      .map((candidate) => candidate.index),
  );
  return parts.map((part, index) => part.whole + (roundedUp.has(index) ? 1 : 0));
}

/**
 * Largest-remainder rounding to `decimals` places: the 1-D reference `roundGrid` must agree with
 * on a single row. The rounded values add up to the rounded `targetTotal` exactly.
 */
export function largestRemainder(values: readonly number[], decimals: number, targetTotal?: number): number[] {
  const scale = stepsPerUnit(decimals);
  const steps = largestRemainderSteps(
    values.map((value) => value * scale),
    targetTotal === undefined ? undefined : targetTotal * scale,
  );
  return steps.map((count) => count / scale);
}

/** Rounds one value outside any grid to whole steps of its display unit (e.g. a single cell or rate). */
export const roundValue = (value: number, unit: DisplayUnit): number => roundSteps(value * stepsOf(unit));
