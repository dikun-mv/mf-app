import { describe, expect, it, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove rate' })).not.toBeInTheDocument();
  });

  it('opens modally while open is true, named by its title, with body and actions', () => {
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} open title="Remove the rate?" onClose={rs.fn()} actions={actions}>
        <p>The next rate starts on 12 Mar 2026.</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Remove the rate?' });
    expect(dialog).toBe(ref.current);
    expect(ref.current?.open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Remove the rate?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('The next rate starts on 12 Mar 2026.');
    expect(screen.getByRole('button', { name: 'Remove rate' })).toBeInTheDocument();
  });

  it('asks the parent to close from the close button, and stays open until told', async () => {
    const onClose = rs.fn();
    const ref = createRef<HTMLDialogElement>();
    const { rerender } = render(
      <Dialog ref={ref} open title="Move item" onClose={onClose}>
        Body
      </Dialog>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
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
    // fireEvent returns false when a listener called preventDefault.
    const notPrevented = fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(notPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
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
    ref.current?.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts its body fresh each time it opens', async () => {
    const element = (open: boolean) => (
      <Dialog open={open} title="Add item" onClose={rs.fn()}>
        <input aria-label="Name" />
      </Dialog>
    );
    const { rerender } = render(element(true));
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Name' }), 'Reconciliation');
    rerender(element(false));
    rerender(element(true));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  });
});
