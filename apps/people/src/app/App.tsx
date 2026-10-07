import '@baseline/ui/tokens.css';
import type { RemoteAppProps } from '@baseline/host-contract';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { RepositoryContext, createAppRepository, createQueryClient, type PeopleRepository } from '../shared/api';
import { reportReact } from '../shared/debug';
import { HostContextProvider } from '../shared/lib';
import { RealtimeProvider } from './RealtimeProvider';
import { useBrowserRouter } from './routing/useBrowserRouter';
import styles from './App.module.css';

reportReact('people');

export interface AppProps extends RemoteAppProps {
  /** Replaces the PocketBase repository. Only tests pass it; the shell passes `ctx` alone. */
  readonly repository?: PeopleRepository;
}

/**
 * The exposed `./App` (D10). Its own router runs under `ctx.basePath`; everything else goes through
 * `ctx.navigate`. Each mount gets its own `QueryClient` (D26), cleared when it unmounts, and its own repository
 * (D30) over the page's origin, where the gateway serves both PocketBase APIs.
 */
export default function App({ ctx, repository }: AppProps) {
  const router = useBrowserRouter(ctx.basePath);
  const [queryClient] = useState(() => createQueryClient());
  const [data] = useState(() => repository ?? createAppRepository(window.location.origin));
  useEffect(
    () => () => {
      queryClient.clear();
    },
    [queryClient],
  );
  return (
    <div data-baseline-root="" className={styles.root}>
      <HostContextProvider ctx={ctx}>
        <QueryClientProvider client={queryClient}>
          <RepositoryContext.Provider value={data}>
            <RealtimeProvider instance="people">{router ? <RouterProvider router={router} /> : null}</RealtimeProvider>
          </RepositoryContext.Provider>
        </QueryClientProvider>
      </HostContextProvider>
    </div>
  );
}
