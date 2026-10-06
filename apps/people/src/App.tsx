import '@baseline/ui/tokens.css';
import type { RemoteAppProps } from '@baseline/host-contract';
import { RouterProvider } from 'react-router/dom';
import { reportReact } from './debug/reactProbe';
import { HostContextProvider } from './host/HostContextProvider';
import { useBrowserRouter } from './routing/useBrowserRouter';
import styles from './App.module.css';

reportReact('people');

/** The exposed `./App` (D10). Its own router runs under `ctx.basePath`; everything else goes through `ctx.navigate`. */
export default function App({ ctx }: RemoteAppProps) {
  const router = useBrowserRouter(ctx.basePath);
  return (
    <div data-baseline-root="" className={styles.root}>
      <HostContextProvider ctx={ctx}>{router ? <RouterProvider router={router} /> : null}</HostContextProvider>
    </div>
  );
}
