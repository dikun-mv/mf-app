import type { HostContext, RemoteHandle } from '@baseline/host-contract';
import { createRoot } from 'react-dom/client';
import type { PeopleRepository } from '../shared/api';
import App from './App';

/**
 * The exposed `./mount` (D10): renders the app into `el`. `update` pushes a new context without remounting.
 * `repository` is a seam for tests; the shell and the standalone page pass none, so the app reads PocketBase.
 */
export function mount(el: HTMLElement, ctx: HostContext, repository?: PeopleRepository): RemoteHandle {
  const root = createRoot(el);
  const render = (next: HostContext): void => {
    root.render(repository ? <App ctx={next} repository={repository} /> : <App ctx={next} />);
  };
  render(ctx);
  return {
    update: render,
    unmount: () => {
      root.unmount();
    },
  };
}
