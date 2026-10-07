import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Field, hasContent, useFieldIds, type FieldProps } from '../Field/Field';
import styles from './Select.module.css';

/** `className` styles the field as a whole (label, select, hint and error), for layout. */
export interface SelectProps extends FieldProps, ComponentPropsWithoutRef<'select'> {}

/**
 * A `<label>` and a native `<select>`, with the same `hint`, `error` and ref forwarding as `TextField`.
 * Pass `<option>`s as children; the browser draws the list, so it is keyboard and screen-reader ready.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, className, id, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const ids = useFieldIds(id, { hint, error }, describedBy);
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className} ids={ids}>
      <select
        {...rest}
        ref={ref}
        id={ids.controlId}
        aria-invalid={hasContent(error) ? true : undefined}
        aria-describedby={ids.describedBy}
        className={styles.select}
      />
    </Field>
  );
});
