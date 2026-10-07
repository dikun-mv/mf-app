import { zodResolver } from '@hookform/resolvers/zod';
import type { EmployeeId, RateRecord } from '@baseline/people-contract';
import { addRate, formatDate, newRateRecordId } from '@baseline/people-domain';
import { useMemo, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { rateFormSchema, refusalOf, type RateFormFields, type RateFormValues } from '../../../entities/rate-record';
import { CONFLICT_MESSAGE, EMPTY_RATE_CHANGE_SET, isConflictError, useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';

interface AddRateOptions {
  employeeId: EmployeeId;
  /** The employee's rate records as they are now, oldest first. */
  history: readonly RateRecord[];
  /** The write went through: the sentence for the widget's status line. */
  onSaved: (message: string) => void;
  /** The write failed for a reason other than a conflict, which the form shows itself. */
  onFailed: (error: unknown) => void;
}

/**
 * The add-a-rate form's state (D27). Three layers check it: the form schema (shapes), then `addRate` on submit
 * (a clash with another rate's start day lands on the day field), then a `conflict` from the server (the
 * form's `root.server`). Nothing is sent until the first two pass. The draft stays while the write is on its
 * way, and is cleared once it is saved.
 */
export function useAddRate({ employeeId, history, onSaved, onFailed }: AddRateOptions) {
  const { currency } = useHost();
  const write = useApplyChangeSet();
  const schema = useMemo(() => rateFormSchema(currency), [currency]);
  const form = useForm<RateFormFields, unknown, RateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { validFrom: '', amount: '' },
  });

  const handle = form.handleSubmit(async ({ validFrom, hourlyCost }) => {
    const record: RateRecord = { id: newRateRecordId(), employeeId, validFrom, hourlyCost };
    const checked = addRate(history, record);
    if (!checked.ok) {
      const { field, message } = refusalOf(checked.error);
      form.setError(field, { message });
      return;
    }
    try {
      await write.mutateAsync({ ...EMPTY_RATE_CHANGE_SET, create: [record] });
    } catch (error) {
      if (isConflictError(error)) form.setError('root.server', { message: CONFLICT_MESSAGE });
      else onFailed(error);
      return;
    }
    form.reset();
    onSaved(`Rate from ${formatDate(validFrom)} added.`);
  });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    void handle(event);
  };

  return { form, submit, currency };
}
