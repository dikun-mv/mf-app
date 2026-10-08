import { DISPLAY_UNITS } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import { act, screen, waitFor } from '@testing-library/react';
import { RepositoryError, collectionKey } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { PeopleUnreachableMessage } from './PeopleUnreachableMessage';

const PM_AND_PERCENT = ['personMonths', 'percent'] as const;
const MESSAGE = /People's data can't be reached/;

describe('PeopleUnreachableMessage', () => {
  it('says People is out of reach when its data failed to load, and what that means for the grid', async () => {
    const repository = createFakeRepository(seedData());
    repository.failReads('employees', new RepositoryError('unavailable', 'people'));
    renderWithApp(<PeopleUnreachableMessage unit="personMonths" units={PM_AND_PERCENT} />, { repository });

    const message = await screen.findByText(MESSAGE);
    expect(message).toHaveTextContent('only Person-months and % are shown, and people show as ids');
  });

  it('is silent while People loads, and once it has loaded', async () => {
    const repository = createFakeRepository(seedData());
    const release = repository.holdReads('employees');
    const { queryClient } = renderWithApp(<PeopleUnreachableMessage unit="personMonths" units={PM_AND_PERCENT} />, {
      repository,
    });
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    act(() => {
      release();
    });
    await waitFor(() => {
      expect(queryClient.getQueryState(collectionKey('employees'))?.status).toBe('success');
    });
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('clears by itself once People’s data can be read again', async () => {
    const repository = createFakeRepository(seedData());
    repository.failReads('rateRecords', new RepositoryError('unavailable', 'people'));
    const { queryClient } = renderWithApp(<PeopleUnreachableMessage unit="percent" units={PM_AND_PERCENT} />, {
      repository,
    });
    await screen.findByText(MESSAGE);

    // What the realtime reconnect does (D29): the instance's queries without data are fetched again.
    repository.failReads('rateRecords', null);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['people'] });
    });
    await waitFor(() => {
      expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });
  });

  it('leaves the message to the grid when the unit shown is one that cannot be drawn', async () => {
    const repository = createFakeRepository(seedData());
    repository.failReads('employees', new RepositoryError('unavailable', 'people'));
    const { queryClient } = renderWithApp(<PeopleUnreachableMessage unit="hours" units={PM_AND_PERCENT} />, {
      repository,
    });
    await waitFor(() => {
      expect(queryClient.getQueryState(collectionKey('employees'))?.status).toBe('error');
    });
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('shows nothing when every unit is available', () => {
    renderWithApp(<PeopleUnreachableMessage unit="cost" units={DISPLAY_UNITS} />, {
      repository: createFakeRepository(seedData()),
    });
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });
});
