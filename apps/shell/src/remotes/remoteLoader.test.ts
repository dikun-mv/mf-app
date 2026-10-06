import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { createRemoteLoader, RemoteLoadTimeoutError, type FederationRuntime } from './remoteLoader';

const entries = { people: 'http://a.test/people/remoteEntry.js', delivery: 'http://a.test/delivery/remoteEntry.js' };
const App = () => null;

function fakeRuntime(loadRemote: FederationRuntime['loadRemote']) {
  const registerRemotes = rs.fn<FederationRuntime['registerRemotes']>();
  const load = rs.fn(loadRemote);
  return { registerRemotes, loadRemote: load } satisfies FederationRuntime;
}

describe('createRemoteLoader', () => {
  it('registers every remote up front, from the given URLs', () => {
    const runtime = fakeRuntime(() => Promise.resolve({ default: App }));
    createRemoteLoader(entries, runtime, 1000);
    expect(runtime.registerRemotes).toHaveBeenCalledWith([
      { name: 'people', entry: entries.people },
      { name: 'delivery', entry: entries.delivery },
    ]);
  });

  it('loads <name>/App once and shares the result', async () => {
    const runtime = fakeRuntime(() => Promise.resolve({ default: App }));
    const loader = createRemoteLoader(entries, runtime, 1000);
    expect(loader.getStatus('people')).toBe('idle');

    const [first, second] = await Promise.all([loader.load('people'), loader.load('people')]);
    expect(first).toBe(App);
    expect(second).toBe(App);
    expect(runtime.loadRemote).toHaveBeenCalledTimes(1);
    expect(runtime.loadRemote).toHaveBeenCalledWith('people/App');
    expect(loader.getStatus('people')).toBe('ready');
    expect(loader.getStatus('delivery')).toBe('idle');
  });

  it('tells subscribers when a status changes, with a snapshot that changes too', async () => {
    const loader = createRemoteLoader(
      entries,
      fakeRuntime(() => Promise.resolve({ default: App })),
      1000,
    );
    const seen: string[] = [];
    const unsubscribe = loader.subscribe(() => seen.push(loader.getSnapshot()));
    await loader.load('delivery');
    unsubscribe();
    await loader.load('people');
    expect(seen).toEqual(['people:idle,delivery:loading', 'people:idle,delivery:ready']);
  });

  it('rejects a module without a default component', async () => {
    const loader = createRemoteLoader(
      entries,
      fakeRuntime(() => Promise.resolve({ default: 42 })),
      1000,
    );
    await expect(loader.load('people')).rejects.toThrow("people remote's ./App has no default component");
    expect(loader.getStatus('people')).toBe('failed');
  });

  it('rejects when the runtime returns nothing (an unknown remote)', async () => {
    const loader = createRemoteLoader(
      entries,
      fakeRuntime(() => Promise.resolve(null)),
      1000,
    );
    await expect(loader.load('people')).rejects.toThrow('no default component');
  });

  describe('a failing remote', () => {
    it('reports the failure, forgets it, and retries with a forced re-registration', async () => {
      let attempts = 0;
      const runtime = fakeRuntime(() => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('script 404')) : Promise.resolve({ default: App });
      });
      const loader = createRemoteLoader(entries, runtime, 1000);

      await expect(loader.load('people')).rejects.toThrow('script 404');
      expect(loader.getStatus('people')).toBe('failed');
      // The other remote is untouched.
      expect(loader.getStatus('delivery')).toBe('idle');

      await expect(loader.load('people')).resolves.toBe(App);
      expect(loader.getStatus('people')).toBe('ready');
      expect(runtime.registerRemotes).toHaveBeenLastCalledWith([{ name: 'people', entry: entries.people }], {
        force: true,
      });
    });

    it('wraps a non-Error rejection', async () => {
      const loader = createRemoteLoader(
        entries,
        // The runtime may reject with a non-Error; the loader wraps it.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        fakeRuntime(() => Promise.reject('boom')),
        1000,
      );
      await expect(loader.load('people')).rejects.toThrow('boom');
    });
  });

  describe('the load timeout', () => {
    beforeEach(() => {
      rs.useFakeTimers();
    });
    afterEach(() => {
      rs.useRealTimers();
    });

    it('fails a remote that never answers', async () => {
      const loader = createRemoteLoader(
        entries,
        fakeRuntime(() => new Promise<never>(() => undefined)),
        5000,
      );
      const outcome = loader.load('people').then(
        () => 'loaded',
        (error: unknown) => error,
      );
      await rs.advanceTimersByTimeAsync(5000);
      expect(await outcome).toBeInstanceOf(RemoteLoadTimeoutError);
      expect(loader.getStatus('people')).toBe('failed');
    });

    it('does not fire once the remote has answered', async () => {
      const loader = createRemoteLoader(
        entries,
        fakeRuntime(() => Promise.resolve({ default: App })),
        5000,
      );
      await loader.load('people');
      await rs.advanceTimersByTimeAsync(10_000);
      expect(loader.getStatus('people')).toBe('ready');
    });
  });
});
