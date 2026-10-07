import { DISPLAY_UNITS, type DisplayUnit } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'react-router';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { useUnit } from '../model/useUnit';
import { UnitSwitcher } from './UnitSwitcher';

function Switcher({ units = DISPLAY_UNITS }: { units?: readonly DisplayUnit[] }) {
  const [unit] = useUnit();
  const [params] = useSearchParams();
  return (
    <>
      <UnitSwitcher unit={unit} units={units} />
      <output aria-label="search">{params.toString()}</output>
    </>
  );
}

describe('UnitSwitcher', () => {
  it('offers the four units in a radio group, person-months selected by default', () => {
    renderWithApp(<Switcher />);
    expect(screen.getByRole('group', { name: 'Unit' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'Hours',
      'Person-months',
      '% of capacity',
      'Cost',
    ]);
    expect(screen.getByRole('radio', { name: 'Person-months' })).toBeChecked();
  });

  it('shows the unit from ?unit=', () => {
    renderWithApp(<Switcher />, { route: '/?unit=cost' });
    expect(screen.getByRole('radio', { name: 'Cost' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Person-months' })).not.toBeChecked();
  });

  it('writes the chosen unit to ?unit= and nothing to the server', async () => {
    const repository = createFakeRepository(seedData());
    renderWithApp(<Switcher />, { repository });
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Cost' }));
    expect(screen.getByRole('radio', { name: 'Cost' })).toBeChecked();
    expect(screen.getByLabelText('search')).toHaveTextContent('unit=cost');
    expect(repository.written).toHaveLength(0);
  });

  it('disables the units that are not available and says so', async () => {
    renderWithApp(<Switcher units={['personMonths', 'percent']} />);
    expect(screen.getByRole('radio', { name: 'Hours (unavailable)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Cost (unavailable)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '% of capacity' })).toBeEnabled();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Cost (unavailable)' }));
    expect(screen.getByLabelText('search')).toBeEmptyDOMElement();
  });
});
