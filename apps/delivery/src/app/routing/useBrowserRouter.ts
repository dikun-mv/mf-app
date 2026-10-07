import { useEffect, useState } from 'react';
import { createRouter } from './createRouter';

type Router = ReturnType<typeof createRouter>;

/**
 * Creates the browser router for `basePath` after mount and disposes it on unmount. A router adds
 * a `popstate` listener when it is created, so creating it in an effect (not during render) keeps
 * StrictMode's mount, unmount, mount cycle from leaving a disposed router in use or a listener behind.
 */
export function useBrowserRouter(basePath: string): Router | null {
  const [router, setRouter] = useState<Router | null>(null);
  useEffect(() => {
    const created = createRouter(basePath);
    setRouter(created);
    return () => {
      created.dispose();
    };
  }, [basePath]);
  return router;
}
