// Delivery's data access (T6.0a): the SDK clients and repository over both PocketBase instances, the query
// keys and client, the cache patching, and the hooks the rest of the app reaches them through. Only this
// segment imports `pocketbase` (D30).
export { applyRealtimeEvent } from './cache';
export {
  COLLECTIONS,
  collectionsOf,
  type CollectionKey,
  type Instance,
  type RecordOf,
  type RecordTypes,
} from './collections';
export { ConnectionStatusProvider, useConnectionStatus, type ConnectionStatus } from './connection';
export { describeError, mapError, RepositoryError, type RepositoryErrorCode } from './errors';
export { collectionKey, collectionQuery, createQueryClient, instanceKey } from './queries';
export { RepositoryProvider, useRepository } from './RepositoryContext';
export type { ChangeSetResult, ConnectionEvent, RealtimeEvent, Repository, Unsubscribe } from './repository';
export { createClients, createSdkRepository, type Clients } from './sdkRepository';
export { useApplyChangeSet } from './useApplyChangeSet';
