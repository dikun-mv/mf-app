import type { HostContext, RemoteHandle } from '@baseline/host-contract';
import { createRoot } from 'react-dom/client';
import type { Repository } from '../shared/api';
import App from './App';

/**
 * The exposed `./mount` (D10): renders the app into `el`. `update` pushes a new context without remounting.
 * The shell and the standalone page pass two arguments; a test passes the fake `repository` as a third (D30).
 */
export function mount(el: HTMLElement, ctx: HostContext, repository?: Repository): RemoteHandle {
  const root = createRoot(el);
  const render = (current: HostContext): void => {
    root.render(repository ? <App ctx={current} repository={repository} /> : <App ctx={current} />);
  };
  render(ctx);
  return {
    update: render,
    unmount: () => {
      root.unmount();
    },
  };
}
