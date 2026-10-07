import type PocketBase from 'pocketbase';
import { parseRecordEvent, type EventCollection } from './parse';
import type { RealtimeHandlers } from './repository';

/** A collection's realtime topic is its name (the contracts' `*_COLLECTIONS`): `subscribe('*')` listens to all of it. */
export interface Topic {
  readonly collection: EventCollection;
  readonly name: string;
}

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000] as const;

/**
 * Subscribes to every topic of one PocketBase instance and returns the function that stops it (D6, D29).
 *
 * The SDK reconnects and resubscribes by itself after a connection that was up has dropped, but not after
 * a first connect that failed: it gives up and rejects. That case is retried here with a growing delay, so a
 * People that opens while its service is down comes back by itself. `onConnect` follows every connect, the
 * first included (`PB_CONNECT`); `onDisconnect` follows every loss. Events missed in between aren't replayed,
 * which is why the provider refetches after a reconnect.
 */
export function subscribeToInstance(pb: PocketBase, topics: readonly Topic[], handlers: RealtimeHandlers): () => void {
  let active = true;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  // The SDK calls this for a lost connection and for our own unsubscribe, which has no subscriptions left.
  pb.realtime.onDisconnect = (subscriptions) => {
    if (active && subscriptions.length > 0) handlers.onDisconnect();
  };

  const failed = (): void => {
    if (!active) return;
    handlers.onDisconnect();
    const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)] ?? 10_000;
    failures += 1;
    // Subscribing starts a connection (`connect` is private) that reuses the listeners already registered; the
    // empty listener only asks for it, and is dropped once it is up.
    retryTimer = setTimeout(() => {
      pb.realtime
        .subscribe('PB_CONNECT', () => undefined)
        .then((stop) => stop())
        .catch(failed);
    }, delay);
  };

  Promise.all([
    pb.realtime.subscribe('PB_CONNECT', () => {
      failures = 0;
      if (active) handlers.onConnect();
    }),
    ...topics.map(({ collection, name }) =>
      pb.collection(name).subscribe('*', (message: unknown) => {
        const event = parseRecordEvent(collection, message);
        if (active && event) handlers.onEvent(event);
      }),
    ),
  ]).catch(failed);

  return () => {
    active = false;
    clearTimeout(retryTimer);
    delete pb.realtime.onDisconnect;
    // No topic: drop every subscription, which closes a live connection.
    pb.realtime.unsubscribe().catch(() => undefined);
    // `unsubscribe` closes only while a client id is set. During the SDK's own reconnect loop it is empty
    // and a timer is pending, so an unmounted app would keep opening connections for as long as the service
    // is down. `disconnect` (private in the types) clears that timer and closes the event source.
    (pb.realtime as unknown as { disconnect(): void }).disconnect();
  };
}
