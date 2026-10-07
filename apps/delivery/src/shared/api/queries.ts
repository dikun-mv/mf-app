import { QueryClient, queryOptions } from '@tanstack/react-query';
import { COLLECTIONS, type CollectionKey, type Instance } from './collections';
import type { Repository } from './repository';

// One query per collection, each the whole collection (D26). The key factories are the only place a key is
// written: a collection's key is `[instance, collection]`, so `instanceKey` is its prefix and invalidating
// an instance after a reconnect (D29) reaches every one of its collections.

export const instanceKey = (instance: Instance) => [instance] as const;

export const collectionKey = <K extends CollectionKey>(key: K) => [COLLECTIONS[key].instance, key] as const;

/**
 * The query of one collection. Realtime keeps it fresh, so it never goes stale by itself and is
 * not refetched on window focus (`staleTime: Infinity` comes from the client's defaults).
 */
export const collectionQuery = <K extends CollectionKey>(repository: Repository, key: K) =>
  queryOptions({ queryKey: collectionKey(key), queryFn: () => repository.list(key) });

/**
 * One client per mounted app (D26). Queries are retried once and mutations never: a retried batch could
 * clash with its own first attempt on client-generated ids (D33). Realtime keeps the cache fresh, so
 * nothing refetches on its own: not on focus, and not when a component mounts.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}
