import { expect, describe, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Button } from './Button';

describe('Button', () => {
  it('is a native button that never submits a form by default', () => {
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Button>Save</Button>
      </form>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick, but not while disabled', async () => {
    const user = userEvent.setup();
    const onClick = rs.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets a form button submit and forwards its ref to the element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} type="submit" variant="primary">
        Add rate
      </Button>,
    );
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Add rate' }));
    expect(ref.current).toHaveAttribute('type', 'submit');
  });
});
