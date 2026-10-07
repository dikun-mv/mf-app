import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

// Typed by the union, so adding a variant fails to compile until it has a style.
const byVariant = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
} satisfies Record<ButtonVariant, string>;

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', type = 'button', className, ...rest },
  ref,
) {
  return <button {...rest} ref={ref} type={type} className={clsx(styles.button, byVariant[variant], className)} />;
});
