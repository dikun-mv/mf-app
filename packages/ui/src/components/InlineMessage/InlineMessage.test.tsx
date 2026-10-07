import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { InlineMessage } from './InlineMessage';

describe('InlineMessage', () => {
  it('announces an error as an alert', () => {
    render(<InlineMessage tone="error">Your change wasn't saved.</InlineMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent("Your change wasn't saved.");
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['info', 'warning'] as const)('shows %s as a polite status', (tone) => {
    render(<InlineMessage tone={tone}>Capacity unknown</InlineMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('Capacity unknown');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is an info status by default', () => {
    render(<InlineMessage>A rate runs until the next one starts.</InlineMessage>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('passes other attributes through, such as an id to point at', () => {
    render(<InlineMessage id="hint">Hint</InlineMessage>);
    expect(screen.getByRole('status')).toHaveAttribute('id', 'hint');
  });
});
