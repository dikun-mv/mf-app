import { createContext, useContext, type ReactNode } from 'react';
import type { Repository } from './repository';

const RepositoryContext = createContext<Repository | null>(null);

/** Gives everything below the repository (D30). `app/` sets it: the SDK one in production, the fake in tests. */
export function RepositoryProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

/** The repository, for query and mutation hooks. Components never call the SDK. */
export function useRepository(): Repository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository must be used inside RepositoryProvider');
  return repository;
}
