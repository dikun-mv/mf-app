import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Field, hasContent, useFieldIds, type FieldProps } from '../Field/Field';
import styles from './TextField.module.css';

/** `className` styles the field as a whole (label, input, hint and error), for layout. */
export interface TextFieldProps extends FieldProps, ComponentPropsWithoutRef<'input'> {}

/**
 * A `<label>` and an `<input>`. The ref goes to the input, so react-hook-form's `register` works on it
 * (D27). Amounts are `inputMode="decimal"` text, dates `type="date"`, search `type="search"`; every
 * other input attribute goes to the input too.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, hint, error, className, id, type = 'text', 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const ids = useFieldIds(id, { hint, error }, describedBy);
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className} ids={ids}>
      <input
        {...rest}
        ref={ref}
        id={ids.controlId}
        type={type}
        aria-invalid={hasContent(error) ? true : undefined}
        aria-describedby={ids.describedBy}
        className={styles.input}
      />
    </Field>
  );
});
