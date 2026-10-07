import { REMOTE_NAMES, ShellConfig, type RemoteName } from './schema';

/** Resolves a relative remote URL against the page's origin; an absolute URL is returned as is. */
export function resolveRemoteUrl(url: string, origin: string): string {
  return new URL(url, origin).href;
}

/** The remote entries by name, each resolved to an absolute URL. */
export function resolveRemotes(remotes: ShellConfig['remotes'], origin: string): Record<RemoteName, string> {
  return {
    people: resolveRemoteUrl(remotes.people, origin),
    delivery: resolveRemoteUrl(remotes.delivery, origin),
  };
}

/**
 * The break switch (T2.6): `?break=people` (or `people,delivery`) swaps that remote's URL for one
 * that 404s, so the shell shows its in-place error without stopping anything.
 */
export function applyBreak(
  remotes: Record<RemoteName, string>,
  search: string,
  origin: string,
): Record<RemoteName, string> {
  const broken = new Set(new URLSearchParams(search).get('break')?.split(',') ?? []);
  const result = { ...remotes };
  for (const name of REMOTE_NAMES) {
    if (broken.has(name)) result[name] = new URL(`/__broken__/${name}/remoteEntry.js`, origin).href;
  }
  return result;
}

export interface LoadedConfig {
  readonly config: ShellConfig;
  /** Absolute entry URLs, with `?break=` already applied. */
  readonly remotes: Record<RemoteName, string>;
}

/** Fetches and validates `/config.json`. Throws with a readable message when it is missing or wrong. */
export async function loadConfig(location: Pick<Location, 'origin' | 'search'>): Promise<LoadedConfig> {
  const response = await fetch('/config.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`/config.json returned ${String(response.status)}`);
  const parsed = ShellConfig.safeParse(await response.json());
  if (!parsed.success) throw new Error(`/config.json is invalid: ${parsed.error.message}`);
  const resolved = resolveRemotes(parsed.data.remotes, location.origin);
  return { config: parsed.data, remotes: applyBreak(resolved, location.search, location.origin) };
}
