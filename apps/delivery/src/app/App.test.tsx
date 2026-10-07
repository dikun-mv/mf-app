import { ActiveUser, type RemoteHandle } from '@baseline/host-contract';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { mount } from './mount';
import { createFakeRepository, seedProjects, testContext } from '../shared/testing';

function goTo(path: string, { notify }: { notify: boolean }): void {
  window.history.pushState({}, '', path);
  // What the shell does after its own navigation (D22).
  if (notify) {
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
}

const repositoryWithProjects = () => createFakeRepository({ projects: seedProjects() });

function mountInAct(el: HTMLElement, repository = repositoryWithProjects()): RemoteHandle {
  let handle: RemoteHandle | undefined;
  act(() => {
    handle = mount(el, testContext(), repository);
  });
  if (!handle) throw new Error('mount did not return a handle');
  return handle;
}

describe('Delivery hosted under /delivery', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/delivery');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows the projects at its base path', async () => {
    render(<App ctx={testContext()} repository={repositoryWithProjects()} />);
    expect(await screen.findByRole('link', { name: 'Ledger Consolidation' })).toBeInTheDocument();
  });

  it("re-reads the URL when the shell's navigate dispatches popstate", async () => {
    render(<App ctx={testContext()} repository={repositoryWithProjects()} />);
    await screen.findByRole('link', { name: 'Ledger Consolidation' });

    goTo('/delivery/prj-1', { notify: true });
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();

    goTo('/delivery', { notify: true });
    expect(await screen.findByRole('link', { name: 'Ledger Consolidation' })).toBeInTheDocument();
  });

  it('does not follow a URL change nobody announced', async () => {
    render(<App ctx={testContext()} repository={repositoryWithProjects()} />);
    await screen.findByRole('link', { name: 'Ledger Consolidation' });
    goTo('/delivery/prj-1', { notify: false });
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  it('loads nothing more while moving between pages, because one query client serves the app', async () => {
    const repository = repositoryWithProjects();
    const list = rs.spyOn(repository, 'list');
    const listed = () => list.mock.calls.filter(([key]) => key === 'projects').length;
    render(<App ctx={testContext()} repository={repository} />);
    await screen.findByRole('link', { name: 'Ledger Consolidation' });
    // The first read, and the refetch when the realtime connection comes up.
    await waitFor(() => {
      expect(listed()).toBe(2);
    });

    goTo('/delivery/prj-1', { notify: true });
    await screen.findByRole('heading', { name: 'Ledger Consolidation' });
    goTo('/delivery', { notify: true });
    await screen.findByRole('link', { name: 'Ledger Consolidation' });

    expect(listed()).toBe(2);
  });
});

describe('Delivery mounted through ./mount', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/delivery');
  });

  it('renders, takes a new context without remounting, and unmounts', async () => {
    const repository = repositoryWithProjects();
    const list = rs.spyOn(repository, 'list');
    const listed = () => list.mock.calls.filter(([key]) => key === 'projects').length;
    const el = document.createElement('div');
    document.body.append(el);
    const handle = mountInAct(el, repository);
    const link = await screen.findByRole('link', { name: 'Ledger Consolidation' });
    await waitFor(() => {
      expect(listed()).toBe(2);
    });

    // The app is not remounted by `update`: the same element stays, and nothing is loaded again.
    act(() => {
      handle.update(testContext({ activeUser: ActiveUser.parse({ id: 'user-2', name: 'Demo Lead' }) }));
    });
    expect(await screen.findByRole('link', { name: 'Ledger Consolidation' })).toBe(link);
    expect(listed()).toBe(2);

    act(() => {
      handle.unmount();
    });
    expect(el).toBeEmptyDOMElement();
    el.remove();
  });
});
