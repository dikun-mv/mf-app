import type { IsoDate } from '@baseline/host-contract';
import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import { type Result, err, ok } from './result';

/** What is wrong with a rate history. */
export type RateHistoryIssue =
  | { readonly code: 'nonPositiveRate'; readonly id: RateRecordId; readonly hourlyCost: number }
  | { readonly code: 'duplicateValidFrom'; readonly validFrom: IsoDate; readonly ids: readonly RateRecordId[] };

export type RateHistoryError =
  | RateHistoryIssue
  | { readonly code: 'notFound'; readonly id: RateRecordId }
  | { readonly code: 'duplicateId'; readonly id: RateRecordId };

/** Oldest first; two records on one day (which `checkRateHistory` flags) go by id. Ids are unique. */
const byValidFrom = (a: RateRecord, b: RateRecord): number =>
  a.validFrom === b.validFrom ? (a.id < b.id ? -1 : 1) : a.validFrom < b.validFrom ? -1 : 1;

/** One employee's records, oldest first. */
export const historyOf = (records: readonly RateRecord[], employeeId: RateRecord['employeeId']): RateRecord[] =>
  records.filter((record) => record.employeeId === employeeId).sort(byValidFrom);

/**
 * The rules of a rate history: every `hourlyCost` above zero, and one record per `validFrom`
 * (a record runs until the next begins, so two on one day are ambiguous). There is no other
 * rule: records may be added, corrected and removed retroactively, and the history may be empty.
 */
export function checkRateHistory(history: readonly RateRecord[]): RateHistoryIssue[] {
  const issues: RateHistoryIssue[] = [];
  const byDay = new Map<IsoDate, RateRecordId[]>();
  for (const record of history) {
    if (!(record.hourlyCost > 0) || !Number.isFinite(record.hourlyCost)) {
      issues.push({ code: 'nonPositiveRate', id: record.id, hourlyCost: record.hourlyCost });
    }
    byDay.set(record.validFrom, [...(byDay.get(record.validFrom) ?? []), record.id]);
  }
  for (const [validFrom, ids] of byDay) {
    if (ids.length > 1) issues.push({ code: 'duplicateValidFrom', validFrom, ids });
  }
  return issues;
}

function validated(history: RateRecord[]): Result<RateRecord[], RateHistoryError> {
  const [issue] = checkRateHistory(history);
  return issue === undefined ? ok(history.sort(byValidFrom)) : err(issue);
}

/** Adds a record to the employee's history, which may start before, between or after existing ones. */
export function addRate(history: readonly RateRecord[], record: RateRecord): Result<RateRecord[], RateHistoryError> {
  if (history.some((existing) => existing.id === record.id)) return err({ code: 'duplicateId', id: record.id });
  return validated([...history, record]);
}

/** Changes the start day or the cost of a record. */
export function correctRate(
  history: readonly RateRecord[],
  id: RateRecordId,
  patch: Partial<Pick<RateRecord, 'validFrom' | 'hourlyCost'>>,
): Result<RateRecord[], RateHistoryError> {
  const target = history.find((record) => record.id === id);
  if (target === undefined) return err({ code: 'notFound', id });
  const corrected: RateRecord = {
    ...target,
    validFrom: patch.validFrom ?? target.validFrom,
    hourlyCost: patch.hourlyCost ?? target.hourlyCost,
  };
  return validated(history.map((record) => (record.id === id ? corrected : record)));
}

/**
 * The rate in effect on a day: the record with the latest `validFrom` on or before it (a record runs
 * until the next begins, and its own day is priced at its cost), or `null` before the first rate or
 * with no rates. Order doesn't matter. "Today" is the caller's to pass, so this never reads a clock.
 */
export function rateOn<T extends Pick<RateRecord, 'validFrom'>>(rates: readonly T[], date: IsoDate): T | null {
  let inEffect: T | null = null;
  for (const rate of rates) {
    if (rate.validFrom <= date && (inEffect === null || rate.validFrom > inEffect.validFrom)) inEffect = rate;
  }
  return inEffect;
}

/** Removes a record. Removing the last one is allowed: every month is then unpriced. */
export function removeRate(history: readonly RateRecord[], id: RateRecordId): Result<RateRecord[], RateHistoryError> {
  if (!history.some((record) => record.id === id)) return err({ code: 'notFound', id });
  return validated(history.filter((record) => record.id !== id));
}
