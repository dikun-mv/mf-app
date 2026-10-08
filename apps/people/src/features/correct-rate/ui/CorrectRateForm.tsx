import { Button, InlineMessage, TableCell, TextField } from '@baseline/ui';
import { useCorrectRate, type CorrectRateOptions } from '../hooks/useCorrectRate';
import styles from './CorrectRateForm.module.css';

/**
 * Correct a rate in its own row (screens 2.4): the day and the cost in the display currency, which the field
 * labels name. Errors sit under their fields. If the rate is removed elsewhere while the form is open, the form
 * keeps what was typed but cannot save it (D37, screens 4).
 */
export function CorrectRateForm(props: CorrectRateOptions) {
  const { form, submit, currency } = useCorrectRate(props);
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;
  const removed = props.stored === undefined;
  return (
    <tr>
      <TableCell colSpan={3} className={styles.cell}>
        <form className={styles.form} noValidate onSubmit={submit}>
          <div className={styles.fields}>
            <TextField
              label="Valid from"
              hideLabel
              type="date"
              error={errors.validFrom?.message}
              {...register('validFrom')}
            />
            <TextField
              label={`Hourly cost (${currency.code})`}
              hideLabel
              inputMode="decimal"
              autoComplete="off"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={removed || isSubmitting}>
                Save
              </Button>
              <Button onClick={props.onDone}>Cancel</Button>
            </div>
          </div>
          {removed ? (
            <InlineMessage tone="warning">
              This rate was removed elsewhere, so the correction can&apos;t be saved.
            </InlineMessage>
          ) : null}
          {errors.root?.server ? <InlineMessage tone="info">{errors.root.server.message}</InlineMessage> : null}
        </form>
      </TableCell>
    </tr>
  );
}
