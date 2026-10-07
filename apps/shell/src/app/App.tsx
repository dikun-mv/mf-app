import '@baseline/ui/tokens.css';
import { InlineMessage, Spinner } from '@baseline/ui';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { browserStorage, loadConfig, REMOTE_NAMES, type LoadedConfig, type SelectionStorage } from '../shared/config';
import { reportShellReact } from '../shared/debug';
import { createRemoteLoader, federation, type RemoteLoader } from '../shared/federation';
import { router } from './routing/router';
import { ShellProvider } from './ShellProvider';
import styles from './App.module.css';

/** How long a remote has to load before its panel shows an error (T2.5). */
const LOAD_TIMEOUT_MS = 10_000;

interface Booted extends LoadedConfig {
  readonly loader: RemoteLoader;
  readonly theme: 'default' | 'contrast';
  readonly storage: SelectionStorage;
}

type Boot = { phase: 'loading' } | { phase: 'failed'; message: string } | { phase: 'ready'; booted: Booted };

async function boot(): Promise<Booted> {
  const { config, remotes } = await loadConfig(window.location);
  const loader = createRemoteLoader(remotes, federation, LOAD_TIMEOUT_MS);
  // Start every load now, so the singleton readout and both panels don't wait for a visit. A failure
  // is kept in the loader's status and shown by the panel, so it is not rethrown here.
  for (const name of REMOTE_NAMES) loader.load(name).catch(() => undefined);
  const theme = new URLSearchParams(window.location.search).get('theme') === 'contrast' ? 'contrast' : 'default';
  return { config, remotes, loader, theme, storage: browserStorage() };
}

/** Boots the shell: fetch and validate `/config.json`, register the remotes, then show the router. */
export default function App() {
  const [state, setState] = useState<Boot>({ phase: 'loading' });

  useEffect(() => {
    reportShellReact();
    let cancelled = false;
    boot().then(
      (ready) => {
        if (!cancelled) setState({ phase: 'ready', booted: ready });
      },
      (error: unknown) => {
        if (!cancelled) setState({ phase: 'failed', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-baseline-root="" className={styles.root}>
      {state.phase === 'ready' ? (
        <ShellProvider {...state.booted}>
          <RouterProvider router={router} />
        </ShellProvider>
      ) : state.phase === 'failed' ? (
        <InlineMessage tone="error">The shell could not start: {state.message}</InlineMessage>
      ) : (
        <Spinner />
      )}
    </div>
  );
}
