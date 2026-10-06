import type { HostContext, RemoteHandle } from '@baseline/host-contract';
import { createRoot } from 'react-dom/client';
import App from './App';

/** The exposed `./mount` (D10): renders the app into `el`. `update` pushes a new context without remounting. */
export function mount(el: HTMLElement, ctx: HostContext): RemoteHandle {
  const root = createRoot(el);
  root.render(<App ctx={ctx} />);
  return {
    update: (next) => {
      root.render(<App ctx={next} />);
    },
    unmount: () => {
      root.unmount();
    },
  };
}
