import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { createClients, createSdkRepository } from './sdkRepository';

// The real SDK, with a fake `EventSource` and fake timers: no server, no network. The SDK reconnects a
// dropped connection by itself, forever; the repository must make that stop with the last subscription.

type Listener = (event: { lastEventId?: string; data?: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onerror: ((event: unknown) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  /** What the server sends: the connection's own `PB_CONNECT` event carries the client id. */
  connect(clientId: string): void {
    for (const listener of this.listeners.get('PB_CONNECT') ?? []) listener({ lastEventId: clientId });
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  rs.useFakeTimers();
  rs.stubGlobal('EventSource', FakeEventSource);
  // Registering the subscriptions with the server.
  rs.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 204 })));
});
afterEach(() => {
  rs.useRealTimers();
  rs.unstubAllGlobals();
});

/** Subscribes to the connection and one collection, brings the connection up, then drops it. */
async function subscribedThenDropped() {
  const repository = createSdkRepository(createClients('http://gateway.test'));
  const events: string[] = [];
  const stops = Promise.all([
    repository.watchConnection('delivery', (event) => events.push(event)),
    repository.subscribe('projects', () => undefined),
  ]);
  await rs.advanceTimersByTimeAsync(0);
  const [first] = FakeEventSource.instances;
  if (!first) throw new Error('nothing connected');
  first.connect('client-1');
  const unsubscribes = await stops;
  expect(events).toEqual(['connected']);

  // The connection drops: the SDK starts reconnecting on its own.
  first.onerror?.(new Event('error'));
  expect(events).toEqual(['connected', 'disconnected']);
  return { unsubscribes, events };
}

describe('the SDK repository’s realtime connection', () => {
  it('keeps reconnecting while subscribed, which is what the test below must see stop', async () => {
    await subscribedThenDropped();
    await rs.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances.length).toBeGreaterThan(3);
  });

  it('opens no new connection after the last subscription is stopped, even while reconnecting', async () => {
    const { unsubscribes } = await subscribedThenDropped();
    await rs.advanceTimersByTimeAsync(1_000);
    const reconnecting = FakeEventSource.instances.length;
    expect(reconnecting).toBeGreaterThan(1);

    await Promise.all(unsubscribes.map((stop) => stop()));
    const opened = FakeEventSource.instances.length;
    await rs.advanceTimersByTimeAsync(120_000);

    expect(FakeEventSource.instances).toHaveLength(opened);
    expect(
      FakeEventSource.instances.every((source) => source.closed || source === FakeEventSource.instances.at(-1)),
    ).toBe(true);
    expect(FakeEventSource.instances.at(-1)?.closed).toBe(true);
  });

  it('closes a connection that is up when the last subscription stops, and stopping twice is harmless', async () => {
    const repository = createSdkRepository(createClients('http://gateway.test'));
    const pending = Promise.all([
      repository.watchConnection('delivery', () => undefined),
      repository.subscribe('projects', () => undefined),
    ]);
    await rs.advanceTimersByTimeAsync(0);
    FakeEventSource.instances[0]?.connect('client-1');
    const stops = await pending;

    await Promise.all(stops.map((stop) => stop()));
    await Promise.all(stops.map((stop) => stop()));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});
