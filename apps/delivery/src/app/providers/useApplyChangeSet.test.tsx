import { EMPTY_CHANGE_SET } from '@baseline/delivery-domain';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  collectionKey,
  collectionQuery,
  describeError,
  RepositoryError,
  useApplyChangeSet,
  useRepository,
} from '../../shared/api';
import { allocation, createFakeRepository, item, renderWithApp, SEEDED_AT } from '../../shared/testing';

const root = item('wbs-1', 'prj-1', null);
const leaf = item('wbs-2', 'prj-1', 'wbs-1');
const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);
const edit = { ...EMPTY_CHANGE_SET, update: { items: [], allocations: [{ ...effort, amount: 0.75 }] } };

function Editor() {
  const { data = [] } = useQuery(collectionQuery(useRepository(), 'allocations'));
  const write = useApplyChangeSet();
  return (
    <>
      <ul>
        {data.map((record) => (
          <li key={record.id}>{`${record.id}: ${String(record.amount)}`}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          write.mutate(edit);
        }}
      >
        Save
      </button>
      {write.error ? <p role="alert">{describeError(write.error)}</p> : null}
    </>
  );
}

function setup() {
  const repository = createFakeRepository({ breakdownItems: [root, leaf], allocations: [effort] });
  const rendered = renderWithApp(<Editor />, { repository });
  // Both collections the write applies to are in the cache before the edit, as on a loaded page.
  rendered.queryClient.setQueryData(collectionKey('breakdownItems'), [root, leaf]);
  return rendered;
}

describe('useApplyChangeSet', () => {
  it('shows the edit at once, then holds the server’s version of the record', async () => {
    const { repository, queryClient } = setup();
    const user = userEvent.setup();
    await screen.findByText('alloc-1: 0.5');
    const release = repository.holdWrites();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    // The write is still pending, and the screen already shows it.
    expect(await screen.findByText('alloc-1: 0.75')).toBeInTheDocument();
    expect(repository.written).toHaveLength(0);

    act(() => {
      release();
    });
    await waitFor(() => {
      expect(repository.written).toEqual([edit]);
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(collectionKey('allocations'))).toEqual([
        expect.objectContaining({ id: 'alloc-1', amount: 0.75 }),
      ]);
    });
    // `delivery-pb` stamps editedAt when the amount changes (D18): the cache has the server’s time.
    expect(repository.stored('allocations')[0]?.editedAt).not.toBe(SEEDED_AT);
    expect(screen.getByText('alloc-1: 0.75')).toBeInTheDocument();
  });

  it('puts the record back and refetches what is shown when the write fails, and does not retry', async () => {
    const { repository } = setup();
    const user = userEvent.setup();
    await screen.findByText('alloc-1: 0.5');
    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    const list = rs.spyOn(repository, 'list');
    const applyChangeSet = rs.spyOn(repository, 'applyChangeSet');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("the Delivery service didn't respond");
    expect(screen.getByText('alloc-1: 0.5')).toBeInTheDocument();
    expect(applyChangeSet).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      // Only a collection something is showing is refetched at once; the tree is marked stale.
      expect(list.mock.calls.map(([key]) => key)).toEqual(['allocations']);
    });
  });
});
