import { getByRole, render } from '../../testing/dom';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('is a status named "Loading" by default', () => {
    render(<Spinner />);
    expect(getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('takes the name assistive technology reads from aria-label', () => {
    render(<Spinner aria-label="Loading People" />);
    expect(getByRole('status', { name: 'Loading People' })).toBeTruthy();
  });
});
