import { clsx } from 'clsx';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import styles from './Dialog.module.css';

export interface DialogProps extends Omit<ComponentPropsWithoutRef<'dialog'>, 'open' | 'title' | 'onClose'> {
  /** Shown modally while true. The parent owns this state: `onClose` asks it to become false. */
  open: boolean;
  title: ReactNode;
  /** Called by the close button and by Esc. The dialog stays open until `open` turns false. */
  onClose: () => void;
  /** Buttons for the footer, such as Cancel and the confirming action. */
  actions?: ReactNode;
}

/**
 * A native `<dialog>` opened with `showModal()` while `open` is true. The browser makes the rest of the
 * page inert, traps Tab, and returns focus to what opened it. The body and actions are only rendered
 * while open, so a form inside starts fresh every time and a closed dialog costs nothing.
 */
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(function Dialog(
  { open, title, onClose, actions, className, children, ...rest },
  ref,
) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // The caller's ref and ours both point at the element.
  const setRef = useCallback(
    (node: HTMLDialogElement | null) => {
      dialogRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      {...rest}
      ref={setRef}
      aria-labelledby={titleId}
      className={clsx(styles.dialog, className)}
      // Esc: ask the parent instead of closing here, so `open` stays the one source of truth.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The browser closed it some other way (a method="dialog" form). Our own close() lands here
      // with `open` already false, and must not report back.
      onClose={() => {
        if (open) onClose();
      }}
    >
      {open ? (
        <>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {actions ? <footer className={styles.actions}>{actions}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
});
