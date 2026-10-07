import '@baseline/ui/tokens.css';
import type { RemoteAppProps } from '@baseline/host-contract';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import {
  createClients,
  createQueryClient,
  createSdkRepository,
  RepositoryProvider,
  type Repository,
} from '../shared/api';
import { reportReact } from '../shared/debug';
import { HostContextProvider } from '../shared/lib';
import { RealtimeProvider } from './providers/RealtimeProvider';
import { useBrowserRouter } from './routing/useBrowserRouter';
import styles from './App.module.css';

reportReact('delivery');

export interface AppProps extends RemoteAppProps {
  /** The repository to use. Left out, the app talks to PocketBase through the page's own origin. Tests pass the fake (D30). */
  repository?: Repository;
}

/**
 * The exposed `./App` (D10). Its own router runs under `ctx.basePath`; everything else goes through
 * `ctx.navigate`. It owns what lives as long as the app does: one `QueryClient` (D26), the repository (D30)
 * and the realtime subscriptions to both instances it reads (D29). `mount`'s `update` re-renders it with a
 * new `ctx`, and the state below survives that.
 */
export default function App({ ctx, repository: provided }: AppProps) {
  const router = useBrowserRouter(ctx.basePath);
  const [queryClient] = useState(createQueryClient);
  const [repository] = useState(() => provided ?? createSdkRepository(createClients(window.location.origin)));
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
          <RepositoryProvider repository={repository}>
            <RealtimeProvider instance="delivery">
              <RealtimeProvider instance="people">
                {router ? <RouterProvider router={router} /> : null}
              </RealtimeProvider>
            </RealtimeProvider>
          </RepositoryProvider>
        </QueryClientProvider>
      </HostContextProvider>
    </div>
  );
}
