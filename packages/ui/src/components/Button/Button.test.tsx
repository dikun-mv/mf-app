import { createRef } from 'react';
import { click, getByRole, render } from '../../testing/dom';
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
    expect(getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('calls onClick, but not while disabled', () => {
    const onClick = rs.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    click(getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    click(getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets a form button submit and forwards its ref to the element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} type="submit" variant="primary">
        Add rate
      </Button>,
    );
    expect(ref.current).toBe(getByRole('button', { name: 'Add rate' }));
    expect(ref.current?.type).toBe('submit');
  });
});
