import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { createPeopleClient } from './clients';
import { subscribeToInstance } from './realtime';
import type { RealtimeHandlers } from './repository';

// The SDK's real realtime service, over a fake `EventSource` (Node has none) and a fake `fetch`, with fake
// timers, so the reconnect loop can be watched without a server.

type Listener = (event: { lastEventId: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(listener));
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  /** The server's first message of a connection. */
  open(): void {
    for (const listener of this.listeners.get('PB_CONNECT') ?? []) listener({ lastEventId: 'client-1' });
  }
}

/** Handlers whose connect and disconnect calls are spies the test can read. */
function handlers() {
  const onConnect = rs.fn();
  const onDisconnect = rs.fn();
  const handlers: RealtimeHandlers = { onEvent: rs.fn(), onConnect, onDisconnect };
  return { handlers, onConnect, onDisconnect };
}

/** Lets the SDK's promises and microtasks settle. */
const settle = () => rs.advanceTimersByTimeAsync(0);

beforeEach(() => {
  FakeEventSource.instances = [];
  rs.useFakeTimers();
  rs.stubGlobal('EventSource', FakeEventSource);
  rs.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
});
afterEach(() => {
  rs.useRealTimers();
  rs.unstubAllGlobals();
  rs.restoreAllMocks();
});

describe('subscribeToInstance', () => {
  it('reports the connect, then a lost connection', async () => {
    const pb = createPeopleClient('http://pb.test');
    const { handlers: h, onConnect, onDisconnect } = handlers();
    subscribeToInstance(pb, [{ collection: 'employees', name: 'employees' }], h);
    await settle();
    FakeEventSource.instances[0]?.open();
    await settle();
    expect(onConnect).toHaveBeenCalledTimes(1);

    FakeEventSource.instances[0]?.onerror?.();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('stops all connection attempts when it is stopped while the SDK is reconnecting', async () => {
    const pb = createPeopleClient('http://pb.test');
    const stop = subscribeToInstance(pb, [{ collection: 'employees', name: 'employees' }], handlers().handlers);
    await settle();
    FakeEventSource.instances[0]?.open();
    await settle();

    // The connection drops: the SDK schedules its own reconnect.
    FakeEventSource.instances[0]?.onerror?.();
    stop();
    const opened = FakeEventSource.instances.length;

    await rs.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(opened);
    expect(FakeEventSource.instances.every((source) => source.closed)).toBe(true);
  });

  it('stops retrying a first connect that failed when it is stopped', async () => {
    const pb = createPeopleClient('http://pb.test');
    const { handlers: h, onDisconnect } = handlers();
    const stop = subscribeToInstance(pb, [{ collection: 'employees', name: 'employees' }], h);
    await settle();
    // The first attempt fails: the SDK gives up and the retry timer starts.
    FakeEventSource.instances[0]?.onerror?.();
    await settle();
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    stop();
    const opened = FakeEventSource.instances.length;
    await rs.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(opened);
  });
});
