import { EMPTY_CHANGE_SET } from '@baseline/delivery-domain';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { collectionKey, RepositoryError, useApplyChangeSet } from '../../../shared/api';
import { allocation, createFakeRepository, item, renderWithApp } from '../../../shared/testing';
import { WriteFailedMessage } from './WriteFailedMessage';

const root = item('wbs-1', 'prj-1', null);
const leaf = item('wbs-2', 'prj-1', 'wbs-1');
const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);
const setTo = (amount: number) => ({
  ...EMPTY_CHANGE_SET,
  update: { items: [], allocations: [{ ...effort, amount }] },
});

/** A writer that can leave the page, as a cell does once its editor has closed. */
function Writer() {
  const [present, setPresent] = useState(true);
  return (
    <>
      <WriteFailedMessage />
      <button
        type="button"
        onClick={() => {
          setPresent(!present);
        }}
      >
        Toggle writer
      </button>
      {present && <WriteButtons />}
    </>
  );
}

function WriteButtons() {
  const write = useApplyChangeSet();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          write.mutate(setTo(0.75));
        }}
      >
        Write A
      </button>
      <button
        type="button"
        onClick={() => {
          write.mutate(setTo(0.8));
        }}
      >
        Write B
      </button>
    </>
  );
}

function setup() {
  const repository = createFakeRepository({ breakdownItems: [root, leaf], allocations: [effort] });
  const rendered = renderWithApp(<Writer />, { repository });
  rendered.queryClient.setQueryData(collectionKey('breakdownItems'), [root, leaf]);
  rendered.queryClient.setQueryData(collectionKey('allocations'), [effort]);
  return { ...rendered, repository };
}

const settle = () =>
  act(async () => {
    await rs.advanceTimersByTimeAsync(0);
  });
const click = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};
const MESSAGE = /Your change wasn't saved: the Delivery service didn't respond/;

describe('WriteFailedMessage', () => {
  beforeEach(() => {
    rs.useFakeTimers();
  });
  afterEach(() => {
    rs.useRealTimers();
  });

  it('shows the failure of an earlier write although a later one is pending and then succeeds', async () => {
    const { repository } = setup();
    repository.failWrites(new RepositoryError('unavailable', 'delivery'), 1);
    const release = repository.holdWrites();

    click('Write A');
    click('Write B');
    await settle();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    release();
    await settle();
    // A failed and was undone while B waited behind it; B went through.
    expect(repository.written).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  });

  it('stays after the cache has forgotten the failed write, until the next write starts', async () => {
    const { repository } = setup();
    repository.failWrites(new RepositoryError('unavailable', 'delivery'), 1);

    click('Write A');
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);

    // The writer is gone, so nothing observes the failed mutation; the cache drops it after its gc time.
    click('Toggle writer');
    await act(async () => {
      await rs.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);

    click('Toggle writer');
    click('Write B');
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    await settle();
    expect(repository.written).toHaveLength(1);
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('says the data changed elsewhere for a conflict', async () => {
    const { repository } = setup();
    repository.failWrites(new RepositoryError('conflict', 'delivery'), 1);
    click('Write A');
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('This data was changed elsewhere and has been reloaded.');
  });
});
