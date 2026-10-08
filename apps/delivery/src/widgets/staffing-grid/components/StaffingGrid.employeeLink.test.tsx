import { ProjectId } from '@baseline/delivery-contract';
import { BasePath, type HostContext } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData, testContext } from '../../../shared/testing';
import { StaffingGrid } from './StaffingGrid';

// A person's name in the grid links to that employee in People (T7.5, D22): a real `<a href>` whose plain
// click goes through `ctx.navigate`, and that still links, saying the id, when People's data is missing (D32).
// Adaeze Okafor (emp-001) is in prj-1 under Design and under Regression, so her name is on two rows.

function renderGrid({ ctx = testContext(), peopleDown = false }: { ctx?: HostContext; peopleDown?: boolean } = {}) {
  const repository = createFakeRepository(seedData());
  if (peopleDown) {
    repository.failReads('employees', new RepositoryError('unavailable', 'people'));
    repository.failReads('rateRecords', new RepositoryError('unavailable', 'people'));
  }
  renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} />
    </Suspense>,
    { repository, ctx },
  );
  return ctx;
}

/** The first link in the grid that says `name`. */
async function linkTo(name: string): Promise<HTMLElement> {
  const [first] = await screen.findAllByRole('link', { name });
  if (first === undefined) throw new Error(`No link named ${name}`);
  return first;
}

describe('A person row in the staffing grid links to People', () => {
  it('with an href beside the delivery app when hosted', async () => {
    renderGrid();
    expect(await linkTo('Adaeze Okafor')).toHaveAttribute('href', '/people/emp-001');
  });

  it('with an href under the remotes prefix when standalone', async () => {
    renderGrid({ ctx: testContext({ basePath: BasePath.parse('/remotes/delivery') }) });
    expect(await linkTo('Adaeze Okafor')).toHaveAttribute('href', '/remotes/people/emp-001');
  });

  it('through ctx.navigate, once, on a plain click, which the browser then does not follow', async () => {
    const ctx = renderGrid();
    const link = await linkTo('Adaeze Okafor');
    // fireEvent returns false when a listener called preventDefault.
    expect(fireEvent.click(link)).toBe(false);
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith('/people/emp-001');
  });

  it('and with the keyboard: Enter on the focused link navigates', async () => {
    const user = userEvent.setup();
    const ctx = renderGrid();
    (await linkTo('Adaeze Okafor')).focus();
    await user.keyboard('{Enter}');
    expect(ctx.navigate).toHaveBeenCalledWith('/people/emp-001');
  });

  it('leaving a Ctrl-click, a Meta-click, a Shift-click and a middle click to the browser', async () => {
    const ctx = renderGrid();
    const link = await linkTo('Adaeze Okafor');
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('saying the employee id, with the same href, when People is unreachable', async () => {
    const ctx = renderGrid({ peopleDown: true });
    const link = await linkTo('emp-001');
    expect(link).toHaveAttribute('href', '/people/emp-001');
    expect(screen.queryByRole('link', { name: 'Adaeze Okafor' })).not.toBeInTheDocument();
    expect(fireEvent.click(link)).toBe(false);
    expect(ctx.navigate).toHaveBeenCalledWith('/people/emp-001');
  });

  it('on person rows only: the project and WBS rows hold no link', async () => {
    renderGrid();
    await linkTo('Adaeze Okafor');
    expect(screen.queryByRole('link', { name: 'Ledger Consolidation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Design' })).not.toBeInTheDocument();
  });
});
