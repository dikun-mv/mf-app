import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'react-router';
import { renderWithApp } from '../../../shared/testing';
import { useUnit } from './useUnit';

function Probe() {
  const [unit, setUnit] = useUnit();
  const [params] = useSearchParams();
  return (
    <>
      <output aria-label="unit">{unit}</output>
      <output aria-label="search">{params.toString()}</output>
      <button
        type="button"
        onClick={() => {
          setUnit('cost');
        }}
      >
        Cost
      </button>
    </>
  );
}

describe('useUnit', () => {
  it('defaults to person-months', () => {
    renderWithApp(<Probe />);
    expect(screen.getByLabelText('unit')).toHaveTextContent('personMonths');
  });

  it.each(['hours', 'personMonths', 'percent', 'cost'])('reads ?unit=%s', (unit) => {
    renderWithApp(<Probe />, { route: `/?unit=${unit}` });
    expect(screen.getByLabelText('unit')).toHaveTextContent(unit);
  });

  it('falls back to person-months for a value that is not a unit', () => {
    renderWithApp(<Probe />, { route: '/?unit=weeks' });
    expect(screen.getByLabelText('unit')).toHaveTextContent('personMonths');
  });

  it('sets ?unit= without losing other parameters, replacing the history entry', async () => {
    const { router } = renderWithApp(<Probe />, { route: '/?q=a' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cost' }));
    expect(screen.getByLabelText('search')).toHaveTextContent('q=a&unit=cost');
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
