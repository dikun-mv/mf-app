import type { CellMarker } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { CellMarkers } from './CellMarkers';

const marker = (kind: CellMarker['kind'], symbol: CellMarker['symbol'], text: string): CellMarker => ({
  kind,
  symbol,
  text,
});

describe('CellMarkers', () => {
  it('renders nothing for a cell without markers', () => {
    const { container } = render(<CellMarkers cell={{ markers: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws each glyph with its full text as the title and a name for screen readers', () => {
    render(
      <CellMarkers
        cell={{
          markers: [
            marker('overCapacity', '†', 'Over capacity: caused by Implementation.'),
            marker('partiallyPriced', '◐', '8 of 22 working days are before the first rate (12 Mar 2026).'),
          ],
        }}
      />,
    );
    const over = screen.getByTitle('Over capacity: caused by Implementation.');
    expect(over).toHaveTextContent('†');
    expect(over).toHaveTextContent('Over capacity');
    expect(screen.getByTitle(/8 of 22 working days/)).toHaveTextContent('◐');
    expect(screen.getByTitle(/8 of 22 working days/)).toHaveTextContent('Partly priced');
    // The glyph itself is decoration: it is read through its name, not as "dagger".
    expect(screen.getByText('†')).toHaveAttribute('aria-hidden', 'true');
  });

  it('names an unpriced month', () => {
    render(<CellMarkers cell={{ markers: [marker('unpriced', '○', 'The month is before the first rate.')] }} />);
    expect(screen.getByTitle('The month is before the first rate.')).toHaveTextContent('Unpriced');
  });
});
