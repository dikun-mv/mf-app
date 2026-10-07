import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('is a status named "Loading" by default', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('takes the name assistive technology reads from aria-label', () => {
    render(<Spinner aria-label="Loading People" />);
    expect(screen.getByRole('status', { name: 'Loading People' })).toBeInTheDocument();
  });
});
