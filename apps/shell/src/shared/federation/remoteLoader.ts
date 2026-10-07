import type { RemoteAppProps } from '@baseline/host-contract';
import type { ComponentType } from 'react';
import { REMOTE_NAMES, type RemoteName } from '../config';

export type RemoteApp = ComponentType<RemoteAppProps>;
export type RemoteStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** The two calls of the Module Federation runtime the loader needs. Injected so tests don't need a browser build. */
export interface FederationRuntime {
  registerRemotes(remotes: { name: string; entry: string }[], options?: { force?: boolean }): void;
  loadRemote(id: string): Promise<unknown>;
}

// Function-valued properties, not methods, so they can be passed to `useSyncExternalStore` unbound.
export interface RemoteLoader {
  /** Loads `<name>/App` once; a second call shares the in-flight or finished load. A failed load is forgotten, so calling again retries. */
  readonly load: (name: RemoteName) => Promise<RemoteApp>;
  readonly getStatus: (name: RemoteName) => RemoteStatus;
  /** A primitive that changes whenever any status does, for `useSyncExternalStore`. */
  readonly getSnapshot: () => string;
  readonly subscribe: (listener: () => void) => () => void;
}

/** The remote did not answer within the load timeout (T2.5). */
export class RemoteLoadTimeoutError extends Error {
  constructor(name: RemoteName, timeoutMs: number) {
    super(`The ${name} remote did not load within ${String(timeoutMs / 1000)} s.`);
    this.name = 'RemoteLoadTimeoutError';
  }
}

function isRemoteApp(value: unknown): value is RemoteApp {
  return typeof value === 'function';
}

/** `loadRemote('x/App')` resolves to the module namespace; the component is its default export. */
function pickApp(name: RemoteName, module: unknown): RemoteApp {
  const app = typeof module === 'object' && module !== null && 'default' in module ? module.default : null;
  if (!isRemoteApp(app)) throw new Error(`The ${name} remote's ./App has no default component export.`);
  return app;
}

function withTimeout<T>(promise: Promise<T>, name: RemoteName, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RemoteLoadTimeoutError(name, timeoutMs));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Registers every remote at runtime (T2.4) and loads their `./App` on demand. Remote URLs come from
 * `/config.json`, never from the bundle.
 */
export function createRemoteLoader(
  entries: Record<RemoteName, string>,
  runtime: FederationRuntime,
  timeoutMs: number,
): RemoteLoader {
  const status = new Map<RemoteName, RemoteStatus>(REMOTE_NAMES.map((name) => [name, 'idle']));
  const pending = new Map<RemoteName, Promise<RemoteApp>>();
  const failedBefore = new Set<RemoteName>();
  const listeners = new Set<() => void>();
  let snapshot = '';

  const setStatus = (name: RemoteName, next: RemoteStatus): void => {
    status.set(name, next);
    snapshot = REMOTE_NAMES.map((n) => `${n}:${status.get(n) ?? 'idle'}`).join(',');
    listeners.forEach((listener) => {
      listener();
    });
  };
  snapshot = REMOTE_NAMES.map((n) => `${n}:idle`).join(',');

  runtime.registerRemotes(REMOTE_NAMES.map((name) => ({ name, entry: entries[name] })));

  const attempt = async (name: RemoteName): Promise<RemoteApp> => {
    setStatus(name, 'loading');
    try {
      // After a failure the runtime may hold on to the broken entry, so register it again, forced.
      if (failedBefore.has(name)) runtime.registerRemotes([{ name, entry: entries[name] }], { force: true });
      const app = pickApp(name, await withTimeout(runtime.loadRemote(`${name}/App`), name, timeoutMs));
      setStatus(name, 'ready');
      return app;
    } catch (error) {
      failedBefore.add(name);
      setStatus(name, 'failed');
      throw error;
    }
  };

  return {
    load(name) {
      let promise = pending.get(name);
      if (!promise) {
        // A failed load is forgotten (after the promise is stored), so the next call retries.
        promise = attempt(name).catch((error: unknown) => {
          pending.delete(name);
          throw error;
        });
        pending.set(name, promise);
      }
      return promise;
    },
    getStatus: (name) => status.get(name) ?? 'idle',
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
