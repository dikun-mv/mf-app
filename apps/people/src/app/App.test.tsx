import { ActiveUser, type RemoteHandle } from '@baseline/host-contract';
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import { mount } from './mount';
import { createFakeRepository, testContext } from '../shared/testing';

function goTo(path: string, { notify }: { notify: boolean }): void {
  window.history.pushState({}, '', path);
  // What the shell does after its own navigation (D22).
  if (notify) {
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
}

function mountInAct(el: HTMLElement): RemoteHandle {
  let handle: RemoteHandle | undefined;
  act(() => {
    handle = mount(el, testContext(), createFakeRepository());
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

  it('shows the register at its base path', async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    expect(await screen.findByRole('heading', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByText(/Acting as Demo Planner/)).toBeInTheDocument();
  });

  it("re-reads the URL when the shell's navigate dispatches popstate", async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    await screen.findByRole('heading', { name: /register/i });

    goTo('/people/emp-003', { notify: true });
    expect(await screen.findByRole('heading', { name: /Employee emp-003/ })).toBeInTheDocument();

    goTo('/people', { notify: true });
    expect(await screen.findByRole('heading', { name: /register/i })).toBeInTheDocument();
  });

  it('does not follow a URL change nobody announced', async () => {
    render(<App ctx={testContext()} repository={createFakeRepository()} />);
    await screen.findByRole('heading', { name: /register/i });
    goTo('/people/emp-003', { notify: false });
    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
  });
});

describe('People mounted through ./mount', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/people');
  });

  it('renders, takes a new context without remounting, and unmounts', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const handle = mountInAct(el);
    expect(await screen.findByText(/Acting as Demo Planner/)).toBeInTheDocument();

    // State survives `update`: the component is not remounted.
    act(() => {
      screen.getByRole('button', { name: /Clicked 0 times/ }).click();
    });
    act(() => {
      handle.update(testContext({ activeUser: ActiveUser.parse({ id: 'user-2', name: 'Demo Lead' }) }));
    });
    expect(await screen.findByText(/Acting as Demo Lead/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clicked 1 times/ })).toBeInTheDocument();

    act(() => {
      handle.unmount();
    });
    expect(el).toBeEmptyDOMElement();
    el.remove();
  });
});
