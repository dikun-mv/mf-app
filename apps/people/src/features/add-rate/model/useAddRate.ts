import { zodResolver } from '@hookform/resolvers/zod';
import type { EmployeeId, RateRecord } from '@baseline/people-contract';
import { addRate, formatDate, newRateRecordId } from '@baseline/people-domain';
import { useEffect, useMemo, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { rateFormSchema, refusalOf, type RateFormFields, type RateFormValues } from '../../../entities/rate-record';
import { CONFLICT_MESSAGE, EMPTY_RATE_CHANGE_SET, isConflictError, useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';

interface AddRateOptions {
  employeeId: EmployeeId;
  /** The employee's rate records as they are now, oldest first. */
  history: readonly RateRecord[];
  /** A write is about to be sent: the previous failure, if any, no longer applies. */
  onStart: () => void;
  /** The write went through: the sentence for the widget's status line. */
  onSaved: (message: string) => void;
  /** The write failed for a reason other than a conflict, which the form shows itself. */
  onFailed: (error: unknown) => void;
}

/**
 * The add-a-rate form's state (D27). Three layers check it: the form schema (shapes), then `addRate` on submit
 * (a clash with another rate's start day lands on the day field), then a `conflict` from the server (the
 * form's `root.server`). Nothing is sent until the first two pass. The draft stays while the write is on its
 * way, and is cleared once it is saved, unless it was edited meanwhile.
 */
export function useAddRate({ employeeId, history, onStart, onSaved, onFailed }: AddRateOptions) {
  const { currency } = useHost();
  const write = useApplyChangeSet();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const schema = useMemo(() => rateFormSchema(currency), [currency]);
  const form = useForm<RateFormFields, unknown, RateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { validFrom: '', amount: '' },
  });

  const handle = form.handleSubmit(async ({ validFrom, hourlyCost }) => {
    const submitted = form.getValues();
    const record: RateRecord = { id: newRateRecordId(), employeeId, validFrom, hourlyCost };
    const checked = addRate(history, record);
    if (!checked.ok) {
      const { field, message } = refusalOf(checked.error);
      form.setError(field, { message });
      return;
    }
    onStart();
    try {
      await write.mutateAsync({ ...EMPTY_RATE_CHANGE_SET, create: [record] });
    } catch (error) {
      // A form that has gone (cancelled, replaced, remounted) can't show a conflict, so the widget does.
      if (isConflictError(error) && mounted.current) form.setError('root.server', { message: CONFLICT_MESSAGE });
      else onFailed(error);
      return;
    }
    // Only a form still holding what was sent is cleared: anything typed while the write was on its way is the
    // next draft, and stays.
    const now = form.getValues();
    if (now.validFrom === submitted.validFrom && now.amount === submitted.amount) form.reset();
    onSaved(`Rate from ${formatDate(validFrom)} added.`);
  });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    void handle(event);
  };

  return { form, submit, currency };
}
