import { act, createRef } from 'react';
import { click, getByRole, queryByRole, render, type } from '../../testing/dom';
import { Dialog } from './Dialog';

const actions = <button>Remove rate</button>;

describe('Dialog', () => {
  it('renders nothing visible while closed', () => {
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} open={false} title="Remove the rate?" onClose={rs.fn()} actions={actions}>
        <p>The next rate starts on 12 Mar 2026.</p>
      </Dialog>,
    );
    expect(ref.current?.open).toBe(false);
    expect(queryByRole('dialog')).toBeNull();
    expect(queryByRole('button', { name: 'Remove rate' })).toBeNull();
  });

  it('opens modally while open is true, named by its title, with body and actions', () => {
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} open title="Remove the rate?" onClose={rs.fn()} actions={actions}>
        <p>The next rate starts on 12 Mar 2026.</p>
      </Dialog>,
    );
    const dialog = getByRole('dialog', { name: 'Remove the rate?' });
    expect(dialog).toBe(ref.current);
    expect(ref.current?.open).toBe(true);
    expect(getByRole('heading', { name: 'Remove the rate?' })).toBeTruthy();
    expect(dialog.textContent).toContain('The next rate starts on 12 Mar 2026.');
    expect(getByRole('button', { name: 'Remove rate' })).toBeTruthy();
  });

  it('asks the parent to close from the close button, and stays open until told', () => {
    const onClose = rs.fn();
    const ref = createRef<HTMLDialogElement>();
    const { rerender } = render(
      <Dialog ref={ref} open title="Move item" onClose={onClose}>
        Body
      </Dialog>,
    );
    click(getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ref.current?.open).toBe(true);

    rerender(
      <Dialog ref={ref} open={false} title="Move item" onClose={onClose}>
        Body
      </Dialog>,
    );
    expect(ref.current?.open).toBe(false);
    // Closing because the parent said so is not a request to close.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks the parent to close on Esc, without closing by itself', () => {
    const onClose = rs.fn();
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} open title="Delete item" onClose={onClose}>
        Body
      </Dialog>,
    );
    const esc = new Event('cancel', { cancelable: true });
    act(() => {
      ref.current?.dispatchEvent(esc);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(esc.defaultPrevented).toBe(true);
    expect(ref.current?.open).toBe(true);
  });

  it('reports a close the browser made itself, such as a method="dialog" form', () => {
    const onClose = rs.fn();
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} open title="Delete item" onClose={onClose}>
        Body
      </Dialog>,
    );
    act(() => {
      ref.current?.close();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts its body fresh each time it opens', () => {
    const element = (open: boolean) => (
      <Dialog open={open} title="Add item" onClose={rs.fn()}>
        <input aria-label="Name" />
      </Dialog>
    );
    const { rerender } = render(element(true));
    type(getByRole('textbox', { name: 'Name' }) as HTMLInputElement, 'Reconciliation');
    rerender(element(false));
    rerender(element(true));
    expect((getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('');
  });
});
