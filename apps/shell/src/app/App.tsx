import '@baseline/ui/tokens.css';
import { InlineMessage, Spinner } from '@baseline/ui';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { initialSelection, loadConfig, REMOTE_NAMES } from '../shared/config';
import { reportShellReact } from '../shared/debug';
import { createRemoteLoader, federation } from '../shared/federation';
import { ShellContext, type ShellState } from '../shared/lib';
import { router } from './routing/router';
import styles from './App.module.css';

/** How long a remote has to load before its panel shows an error (T2.5). */
const LOAD_TIMEOUT_MS = 10_000;

type Boot = { phase: 'loading' } | { phase: 'failed'; message: string } | { phase: 'ready'; state: ShellState };

async function boot(): Promise<ShellState> {
  const { config, remotes } = await loadConfig(window.location);
  const loader = createRemoteLoader(remotes, federation, LOAD_TIMEOUT_MS);
  // Start every load now, so the singleton readout and both panels don't wait for a visit. A failure
  // is kept in the loader's status and shown by the panel, so it is not rethrown here.
  for (const name of REMOTE_NAMES) loader.load(name).catch(() => undefined);
  const theme = new URLSearchParams(window.location.search).get('theme') === 'contrast' ? 'contrast' : 'default';
  return { ...initialSelection(config), loader, theme };
}

/** Boots the shell: fetch and validate `/config.json`, register the remotes, then show the router. */
export default function App() {
  const [state, setState] = useState<Boot>({ phase: 'loading' });

  useEffect(() => {
    reportShellReact();
    let cancelled = false;
    boot().then(
      (ready) => {
        if (!cancelled) setState({ phase: 'ready', state: ready });
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
        <ShellContext.Provider value={state.state}>
          <RouterProvider router={router} />
        </ShellContext.Provider>
      ) : state.phase === 'failed' ? (
        <InlineMessage tone="error">The shell could not start: {state.message}</InlineMessage>
      ) : (
        <Spinner />
      )}
    </div>
  );
}
