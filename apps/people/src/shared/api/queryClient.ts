import { QueryClient } from '@tanstack/react-query';

/**
 * The app's `QueryClient` (D26, D33). Realtime keeps the cache fresh, so nothing goes stale on its own and
 * a focus change refetches nothing. A failed read is tried once more; a write is never retried, because a
 * retried batch could clash with its own first attempt on client-generated ids. Tests pass `retry: false`.
 */
export function createQueryClient({ retry = 1 }: { retry?: number | false } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry },
      mutations: { retry: 0 },
    },
  });
}
