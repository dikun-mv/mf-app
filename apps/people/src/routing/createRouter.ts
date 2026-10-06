import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

/**
 * This app's own router over the shared `window.history` (D22). `basename` is the `basePath` the
 * shell gave us, or the standalone page's own path. The router listens for `popstate` itself, so
 * a `popstate` the shell dispatches after its own navigation makes it re-read the URL.
 */
export function createRouter(basePath: string) {
  return createBrowserRouter(routes, { basename: basePath });
}
