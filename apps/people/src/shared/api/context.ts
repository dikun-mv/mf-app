import { createContext, useContext } from 'react';
import type { Instance, PeopleRepository, RealtimeStatus } from './repository';

// The contexts live here, in `shared`, so every layer above can read them; the providers that fill them
// belong to `app/` (D29, D30), and `renderWithApp` fills them with fakes.

export const RepositoryContext = createContext<PeopleRepository | null>(null);

/** The app's repository (D30). Query and mutation hooks call it, never the SDK. */
export function useRepository(): PeopleRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository must be used inside a RepositoryContext provider');
  return repository;
}

/** The connection status of each instance that has a `RealtimeProvider` above. */
export type RealtimeStatuses = Readonly<Partial<Record<Instance, RealtimeStatus>>>;

export const RealtimeStatusContext = createContext<RealtimeStatuses>({});

/** Whether an instance's realtime connection is up. An instance nobody subscribes to counts as `down`. */
export function useRealtimeStatus(instance: Instance): RealtimeStatus {
  return useContext(RealtimeStatusContext)[instance] ?? 'down';
}
