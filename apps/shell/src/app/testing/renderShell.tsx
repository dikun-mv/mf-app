import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { SelectionStorage } from '../../shared/config';
import type { RemoteLoader } from '../../shared/federation';
import { fakeLoader, memoryStorage, testConfig } from '../../shared/testing';
import { routes } from '../routing/routes';
import { ShellProvider } from '../ShellProvider';

interface RenderShellOptions {
  loader?: RemoteLoader;
  storage?: SelectionStorage;
}

/** The shell as `App` assembles it, minus the boot: the real routes and provider, a memory router at `path`. */
export function renderShell(
  path: string,
  { loader = fakeLoader(), storage = memoryStorage() }: RenderShellOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <ShellProvider
      config={testConfig}
      loader={loader}
      remotes={{ people: '/remotes/people/remoteEntry.js', delivery: '/remotes/delivery/remoteEntry.js' }}
      theme="default"
      storage={storage}
    >
      <RouterProvider router={router} />
    </ShellProvider>,
  );
  return { router, storage, ...view };
}
