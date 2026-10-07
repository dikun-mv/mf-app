import type { HostContext } from '@baseline/host-contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RepositoryProvider } from '../api';
import { HostContextProvider } from '../lib';
import { createFakeRepository, type FakeRepository } from './fakeRepository';
import { testContext } from './hostContext';

export interface RenderWithAppOptions {
  /** The "server" the app talks to. A new empty one by default. */
  repository?: FakeRepository;
  ctx?: HostContext;
  /** Where the router starts, relative to the app's base path. */
  route?: string;
  /** The route pattern `ui` is rendered under, e.g. `:projectId`. Everything by default. */
  path?: string;
}

export interface AppRender extends RenderResult {
  readonly repository: FakeRepository;
  readonly queryClient: QueryClient;
  readonly router: ReturnType<typeof createMemoryRouter>;
}

/**
 * Renders `ui` the way `App` does, minus realtime: the host context, a fresh `QueryClient` that doesn't
 * retry (D30), the repository and a memory router. Pass a `repository` to seed or to drive the "server".
 */
export function renderWithApp(
  ui: ReactElement,
  { repository = createFakeRepository(), ctx = testContext(), route = '/', path = '*' }: RenderWithAppOptions = {},
): AppRender {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] });
  const result = render(
    <HostContextProvider ctx={ctx}>
      <QueryClientProvider client={queryClient}>
        <RepositoryProvider repository={repository}>
          <RouterProvider router={router} />
        </RepositoryProvider>
      </QueryClientProvider>
    </HostContextProvider>,
  );
  return Object.assign(result, { repository, queryClient, router });
}
