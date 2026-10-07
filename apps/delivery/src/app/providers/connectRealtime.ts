import type { QueryClient } from '@tanstack/react-query';
import {
  applyRealtimeEvent,
  collectionsOf,
  instanceKey,
  type ConnectionEvent,
  type ConnectionStatus,
  type Instance,
  type Repository,
  type Unsubscribe,
} from '../../shared/api';

export interface RealtimeOptions {
  readonly repository: Repository;
  readonly client: QueryClient;
  readonly instance: Instance;
  /** Called with each change of the connection's status. */
  readonly onStatus: (status: ConnectionStatus) => void;
  /** The wait before the next try after a connect fails, by attempt. Replaced in tests. */
  readonly retryDelay?: (attempt: number) => number;
}

const defaultRetryDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, 15_000);

/**
 * Keeps one instance's collections in the query cache (D29): subscribes to each, patches the matching
 * query by id on every event, and refetches the instance's queries once connected, because events from before
 * a (re)connect aren't replayed (D6). The SDK reconnects a connection that dropped on its own but doesn't retry a
 * first connect that failed, so this does, with a growing wait. Returns the function that stops it all.
 */
export function connectRealtime({
  repository,
  client,
  instance,
  onStatus,
  retryDelay = defaultRetryDelay,
}: RealtimeOptions): () => void {
  let stopped = false;
  let missedEvents = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscriptions: Unsubscribe[] = [];

  const onConnection = (event: ConnectionEvent): void => {
    if (stopped) return;
    if (event === 'disconnected') {
      missedEvents = true;
      onStatus('down');
      return;
    }
    // A connection after a drop, or after a failed first try, may have missed events, so every query is
    // refetched. The first connect isn't live until after the first reads were sent: what was edited in
    // between is in none of them, and nothing refetches by itself (`staleTime: Infinity`). So a collection
    // that has already loaded is refetched too; one still loading is left to finish.
    const everything = missedEvents;
    void client.invalidateQueries({
      queryKey: instanceKey(instance),
      predicate: ({ state }) => everything || state.status === 'success',
    });
    missedEvents = false;
    attempt = 0;
    onStatus('live');
  };

  const release = async (): Promise<void> => {
    const toStop = subscriptions;
    subscriptions = [];
    await Promise.all(toStop.map((stop) => stop().catch(() => undefined)));
  };

  async function open(): Promise<void> {
    // All in one tick: the connection's first `connected` fires as soon as the first subscription opens it.
    const results = await Promise.allSettled([
      repository.watchConnection(instance, onConnection),
      ...collectionsOf(instance).map((key) =>
        repository.subscribe(key, (event) => {
          applyRealtimeEvent(client, key, event);
        }),
      ),
    ]);
    for (const result of results) {
      if (result.status === 'fulfilled') subscriptions.push(result.value);
    }
    if (stopped || results.some(({ status }) => status === 'rejected')) {
      await release();
      if (stopped) return;
      missedEvents = true;
      onStatus('down');
      timer = setTimeout(() => {
        void open();
      }, retryDelay(attempt));
      attempt += 1;
    }
  }

  void open();

  return () => {
    stopped = true;
    clearTimeout(timer);
    void release();
    void client.cancelQueries({ queryKey: instanceKey(instance) });
  };
}
