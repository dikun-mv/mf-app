import type { HostContext } from '@baseline/host-contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
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

const isElement = (target: ReactElement | readonly RouteObject[]): target is ReactElement => !Array.isArray(target);

export interface AppRender extends RenderResult {
  readonly repository: FakeRepository;
  readonly queryClient: QueryClient;
  readonly router: ReturnType<typeof createMemoryRouter>;
}

/**
 * Renders `ui` the way `App` does, minus realtime: the host context, a fresh `QueryClient` that doesn't
 * retry (D30), the repository and a memory router. Pass a `repository` to seed or to drive the "server".
 * Pass a list of routes instead of `ui` to render the app's own routes.
 */
export function renderWithApp(
  target: ReactElement | readonly RouteObject[],
  { repository = createFakeRepository(), ctx = testContext(), route = '/', path = '*' }: RenderWithAppOptions = {},
): AppRender {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const routes = isElement(target) ? [{ path, element: target }] : [...target];
  const router = createMemoryRouter(routes, { initialEntries: [route] });
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
