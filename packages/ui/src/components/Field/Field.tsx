import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';
import styles from './Field.module.css';

/** What `TextField` and `Select` share: a label, the control, and the hint and error under it. */
export interface FieldProps {
  label: ReactNode;
  /** Keeps the label for assistive technology and hides it on screen (a search box, a cell editor). */
  hideLabel?: boolean | undefined;
  /** Help that is always shown, linked to the control with `aria-describedby`. */
  hint?: ReactNode;
  /** Why the value is refused. Shown in the danger tone, and the control is `aria-invalid`. */
  error?: ReactNode;
  className?: string | undefined;
}

interface FieldIds {
  readonly controlId: string;
  readonly hintId: string;
  readonly errorId: string;
  /** For the control's `aria-describedby`: the error, the hint, and anything the caller already set. */
  describedBy: string | undefined;
}

/** The ids that tie a control to its label, hint and error. A given `id` wins over a generated one. */
export function useFieldIds(
  id: string | undefined,
  { hint, error }: Pick<FieldProps, 'hint' | 'error'>,
  describedBy: string | undefined,
): FieldIds {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const ids = [hasContent(error) ? errorId : undefined, hasContent(hint) ? hintId : undefined, describedBy].filter(
    (value) => value !== undefined,
  );
  return { controlId, hintId, errorId, describedBy: ids.length > 0 ? ids.join(' ') : undefined };
}

export function hasContent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  className,
  ids,
  children,
}: FieldProps & { ids: FieldIds; children: ReactNode }) {
  return (
    <div className={clsx(styles.field, className)}>
      <label htmlFor={ids.controlId} className={clsx(styles.label, hideLabel && styles.visuallyHidden)}>
        {label}
      </label>
      {children}
      {hasContent(error) ? (
        <p id={ids.errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
      {hasContent(hint) ? (
        <p id={ids.hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
