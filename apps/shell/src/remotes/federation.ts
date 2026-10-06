import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';
import type { FederationRuntime } from './remoteLoader';

/** The Module Federation 2.0 runtime, behind the small interface the loader needs. */
export const federation: FederationRuntime = {
  registerRemotes: (remotes, options) => {
    registerRemotes(remotes, options);
  },
  loadRemote: (id) => loadRemote(id),
};
