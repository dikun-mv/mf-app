import type { EmployeeId, RateRecord } from '@baseline/people-contract';
import { Button, InlineMessage, TextField } from '@baseline/ui';
import { useAddRate } from '../model/useAddRate';
import styles from './AddRateForm.module.css';

export interface AddRateFormProps {
  employeeId: EmployeeId;
  history: readonly RateRecord[];
  onStart: () => void;
  onSaved: (message: string) => void;
  onFailed: (error: unknown) => void;
}

/**
 * Add a rate (screens 2.3): the day it starts and its hourly cost in the display currency, which the label
 * names. Past dates are allowed. The rate is stored in EUR (D11) and listed as soon as it is sent.
 */
export function AddRateForm(props: AddRateFormProps) {
  const { form, submit, currency } = useAddRate(props);
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;
  return (
    <form className={styles.form} aria-labelledby="add-rate-title" noValidate onSubmit={submit}>
      <h3 id="add-rate-title" className={styles.title}>
        Add a rate
      </h3>
      <div className={styles.fields}>
        <TextField label="Valid from" type="date" error={errors.validFrom?.message} {...register('validFrom')} />
        <TextField
          label={`Hourly cost (${currency.code})`}
          inputMode="decimal"
          autoComplete="off"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          Add rate
        </Button>
      </div>
      {errors.root?.server ? <InlineMessage tone="info">{errors.root.server.message}</InlineMessage> : null}
      <p className={styles.hint}>A rate runs until the next one starts. Past dates are allowed.</p>
    </form>
  );
}
