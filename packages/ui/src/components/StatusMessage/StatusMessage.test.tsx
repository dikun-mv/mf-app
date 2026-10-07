import { getByRole, render } from '../../testing/dom';
import { StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('is a status region even when it has nothing to say', () => {
    render(<StatusMessage />);
    expect(getByRole('status').textContent).toBe('');
  });

  it('keeps the same region when a result arrives, so it is announced', () => {
    const { rerender } = render(<StatusMessage />);
    const region = getByRole('status');
    rerender(<StatusMessage>Rate from 1 Nov 2026 added.</StatusMessage>);
    expect(getByRole('status')).toBe(region);
    expect(region.textContent).toContain('Rate from 1 Nov 2026 added.');
  });

  it('shows the latest result until the next one replaces it', () => {
    const { rerender } = render(<StatusMessage>Saved 0.50 PM.</StatusMessage>);
    rerender(<StatusMessage>Saved 0.50 PM.</StatusMessage>);
    expect(getByRole('status').textContent).toContain('Saved 0.50 PM.');
    rerender(<StatusMessage>3 allocations moved.</StatusMessage>);
    expect(getByRole('status').textContent).toContain('3 allocations moved.');
    expect(getByRole('status').textContent).not.toContain('Saved 0.50 PM.');
  });

  it('reads the whole message when it changes', () => {
    render(<StatusMessage>Saved</StatusMessage>);
    expect(getByRole('status').getAttribute('aria-atomic')).toBe('true');
  });
});
