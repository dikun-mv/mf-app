import { getByRole, queryByRole, render } from '../../testing/dom';
import { InlineMessage } from './InlineMessage';

describe('InlineMessage', () => {
  it('announces an error as an alert', () => {
    render(<InlineMessage tone="error">Your change wasn't saved.</InlineMessage>);
    expect(getByRole('alert').textContent).toBe("Your change wasn't saved.");
    expect(queryByRole('status')).toBeNull();
  });

  it.each(['info', 'warning'] as const)('shows %s as a polite status', (tone) => {
    render(<InlineMessage tone={tone}>Capacity unknown</InlineMessage>);
    expect(getByRole('status').textContent).toBe('Capacity unknown');
    expect(queryByRole('alert')).toBeNull();
  });

  it('is an info status by default', () => {
    render(<InlineMessage>A rate runs until the next one starts.</InlineMessage>);
    expect(getByRole('status')).toBeTruthy();
  });

  it('passes other attributes through, such as an id to point at', () => {
    render(<InlineMessage id="hint">Hint</InlineMessage>);
    expect(getByRole('status').id).toBe('hint');
  });
});
