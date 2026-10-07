import { zodResolver } from '@hookform/resolvers/zod';
import type { RateRecord } from '@baseline/people-contract';
import { correctRate, displayAmountText, equalsDisplayed, formatDate } from '@baseline/people-domain';
import { useMemo, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { rateFormSchema, refusalOf, type RateFormFields, type RateFormValues } from '../../../entities/rate-record';
import { CONFLICT_MESSAGE, EMPTY_RATE_CHANGE_SET, isConflictError, useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';

export interface CorrectRateOptions {
  /** The rate as it was when the form opened: what the fields start with. */
  opened: RateRecord;
  /** The rate as it is stored now, or `undefined` once it was removed elsewhere (D37). */
  stored: RateRecord | undefined;
  /** The employee's rate records as they are now, oldest first. */
  history: readonly RateRecord[];
  /** The form is finished: saved, unchanged, or cancelled. */
  onDone: () => void;
  onSaved: (message: string) => void;
  /** The write failed for a reason other than a conflict, which the form shows itself. */
  onFailed: (error: unknown) => void;
}

/**
 * The correct-a-rate form's state (D27, D37). The fields start from the rate as it was when the form opened and
 * keep what is typed whatever happens to the rate meanwhile; what is compared is the entered value with the
 * rate as it is stored when Save is pressed. Nothing is sent when neither the day nor the cost (as the field
 * shows it, so a round trip through another currency can't nudge a stored rate) differs. Only what differs is
 * changed, so a corrected day keeps the stored cost to the cent.
 */
export function useCorrectRate({ opened, stored, history, onDone, onSaved, onFailed }: CorrectRateOptions) {
  const { currency } = useHost();
  const write = useApplyChangeSet();
  const schema = useMemo(() => rateFormSchema(currency), [currency]);
  const form = useForm<RateFormFields, unknown, RateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { validFrom: opened.validFrom, amount: displayAmountText(opened.hourlyCost, currency) },
  });

  const handle = form.handleSubmit(async ({ validFrom, entered, hourlyCost }) => {
    if (stored === undefined) return;
    const dayChanged = validFrom !== stored.validFrom;
    const costChanged = !equalsDisplayed(entered, stored.hourlyCost, currency);
    if (!dayChanged && !costChanged) {
      onDone();
      return;
    }
    const checked = correctRate(history, stored.id, {
      ...(dayChanged && { validFrom }),
      ...(costChanged && { hourlyCost }),
    });
    if (!checked.ok) {
      const { field, message } = refusalOf(checked.error);
      form.setError(field, { message });
      return;
    }
    const corrected = checked.value.find(({ id }) => id === stored.id);
    if (corrected === undefined) return; // `correctRate` keeps the record it corrects.
    try {
      await write.mutateAsync({ ...EMPTY_RATE_CHANGE_SET, update: [corrected] });
    } catch (error) {
      if (isConflictError(error)) form.setError('root.server', { message: CONFLICT_MESSAGE });
      else onFailed(error);
      return;
    }
    onDone();
    onSaved(`Rate from ${formatDate(corrected.validFrom)} corrected.`);
  });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    void handle(event);
  };

  return { form, submit, currency };
}
