import { ActiveUser, Currency, type RemoteHandle } from '@baseline/host-contract';
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { mount } from './mount';
import { ADAEZE_CURRENT_RATE, createFakeRepository, testContext } from '../shared/testing';

function goTo(path: string, { notify }: { notify: boolean }): void {
  window.history.pushState({}, '', path);
  // What the shell does after its own navigation (D22).
  if (notify) {
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
}

function mountInAct(el: HTMLElement, repository = createFakeRepository()): RemoteHandle {
  let handle: RemoteHandle | undefined;
  act(() => {
    handle = mount(el, testContext(), repository);
  });
  if (!handle) throw new Error('mount did not return a handle');
  return handle;
}

describe('People hosted under /people', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/people');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows the register at its base path, loaded through the repository', async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Adaeze Okafor' })).toHaveAttribute('href', '/people/emp-001');
  });

  it("re-reads the URL when the shell's navigate dispatches popstate", async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    await screen.findByRole('heading', { name: 'Employees' });

    goTo('/people/emp-003', { notify: true });
    expect(await screen.findByRole('heading', { name: 'Milan Brandt' })).toBeInTheDocument();

    goTo('/people', { notify: true });
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
  });

  it('does not follow a URL change nobody announced', async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    await screen.findByRole('heading', { name: 'Employees' });
    goTo('/people/emp-003', { notify: false });
    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument();
  });

  it('shows a rate that changes elsewhere, from the realtime feed', async () => {
    const repository = createFakeRepository();
    render(<App ctx={testContext()} repository={repository} />);
    const row = await screen.findByRole('row', { name: /Adaeze Okafor/ });
    expect(within(row).getByText('€95.00/h')).toBeInTheDocument();

    act(() => {
      repository.emit({
        collection: 'rateRecords',
        action: 'update',
        record: { ...ADAEZE_CURRENT_RATE, hourlyCost: 96 },
      });
    });
    expect(await within(row).findByText('€96.00/h')).toBeInTheDocument();
  });

  it('subscribes to People’s realtime feed while mounted and lets go of it on unmount', async () => {
    const repository = createFakeRepository();
    const { unmount } = render(<App ctx={testContext()} repository={repository} />);
    await screen.findByRole('heading', { name: 'Employees' });
    expect(repository.openSubscriptions('people')).toBe(1);
    unmount();
    expect(repository.openSubscriptions('people')).toBe(0);
  });
});

describe('People mounted through ./mount', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/people');
  });

  it('renders, takes a new context without remounting, and unmounts', async () => {
    const user = userEvent.setup();
    const el = document.createElement('div');
    document.body.append(el);
    const handle = mountInAct(el);
    expect(await screen.findByText('€95.00/h')).toBeInTheDocument();

    // State survives `update`: the component is not remounted.
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'okafor');
    act(() => {
      handle.update(
        testContext({
          currency: Currency.parse({ code: 'USD', perEur: 1.08 }),
          activeUser: ActiveUser.parse({ id: 'user-2', name: 'Demo Lead' }),
        }),
      );
    });
    expect(await screen.findByText('$102.60/h')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search/i })).toHaveValue('okafor');

    act(() => {
      handle.unmount();
    });
    expect(el).toBeEmptyDOMElement();
    el.remove();
  });
});
