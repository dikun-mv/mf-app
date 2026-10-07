import { rs } from '@rstest/core';
import type { RemoteApp, RemoteLoader } from '../federation';
import { ShellConfig, type SelectionStorage } from '../config';

/** The seed's runtime config: three currencies, two users. */
export const testConfig: ShellConfig = ShellConfig.parse({
  remotes: { people: '/remotes/people/remoteEntry.js', delivery: '/remotes/delivery/remoteEntry.js' },
  currencies: [
    { code: 'EUR', perEur: 1 },
    { code: 'USD', perEur: 1.08 },
    { code: 'GBP', perEur: 0.85 },
  ],
  defaultCurrency: 'EUR',
  users: [
    { id: 'user-1', name: 'Demo Planner' },
    { id: 'user-2', name: 'Demo Lead' },
  ],
});

/** A `Storage` that lives in memory, so a test sees exactly what the shell wrote. */
export function memoryStorage(
  initial: Record<string, string> = {},
): SelectionStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

/** A loader whose remotes resolve to the given app, or never, with a fixed status for the strip. */
export function fakeLoader(app?: RemoteApp, status: RemoteLoader['getStatus'] = () => 'ready'): RemoteLoader {
  return {
    load: rs.fn(() => (app ? Promise.resolve(app) : new Promise<RemoteApp>(() => undefined))),
    getStatus: status,
    getSnapshot: () => '',
    subscribe: () => () => undefined,
  };
}
