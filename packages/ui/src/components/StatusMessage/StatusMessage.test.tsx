import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('is a status region even when it has nothing to say', () => {
    render(<StatusMessage />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps the same region when a result arrives, so it is announced', () => {
    const { rerender } = render(<StatusMessage />);
    const region = screen.getByRole('status');
    rerender(<StatusMessage>Rate from 1 Nov 2026 added.</StatusMessage>);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Rate from 1 Nov 2026 added.');
  });

  it('shows the latest result until the next one replaces it', () => {
    const { rerender } = render(<StatusMessage>Saved 0.50 PM.</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved 0.50 PM.');
    rerender(<StatusMessage>3 allocations moved.</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('3 allocations moved.');
    expect(screen.getByRole('status')).not.toHaveTextContent('Saved 0.50 PM.');
  });

  it('reads the whole message when it changes', () => {
    render(<StatusMessage>Saved</StatusMessage>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });
});
