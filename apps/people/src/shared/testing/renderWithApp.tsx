import type { HostContext } from '@baseline/host-contract';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { RealtimeStatusContext, RepositoryContext, createQueryClient } from '../api';
import { HostContextProvider } from '../lib';
import { createFakeRepository, type FakeRepository } from './fakeRepository';
import { testContext } from './hostContext';

export interface RenderWithAppOptions {
  /** The URL the router starts at, relative to the app's base path: `'/'`, `'/?q=okafor'`, `'/emp-001'`. */
  route?: string;
  repository?: FakeRepository;
  ctx?: HostContext;
}

export interface RenderedApp extends RenderResult {
  repository: FakeRepository;
  queryClient: QueryClient;
  /** For asserting on the URL, `?q=` included. */
  router: ReturnType<typeof createMemoryRouter>;
}

/**
 * Renders `ui` (or a list of routes, for the app's own) the way the app does (D30): in a memory router, with a fresh `QueryClient` (`retry: false`),
 * the in-memory repository and the host context. Realtime reads as connected; a test that needs the real
 * provider renders `RealtimeProvider` itself.
 */
export function renderWithApp(
  ui: ReactElement | RouteObject[],
  { route = '/', repository = createFakeRepository(), ctx = testContext() }: RenderWithAppOptions = {},
): RenderedApp {
  const queryClient = createQueryClient({ retry: false });
  const router = createMemoryRouter(Array.isArray(ui) ? ui : [{ path: '*', element: ui }], { initialEntries: [route] });
  const result = render(
    <HostContextProvider ctx={ctx}>
      <QueryClientProvider client={queryClient}>
        <RepositoryContext.Provider value={repository}>
          <RealtimeStatusContext.Provider value={{ people: 'live', delivery: 'live' }}>
            <RouterProvider router={router} />
          </RealtimeStatusContext.Provider>
        </RepositoryContext.Provider>
      </QueryClientProvider>
    </HostContextProvider>,
  );
  return { ...result, repository, queryClient, router };
}
