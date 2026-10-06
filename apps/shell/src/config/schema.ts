import { ActiveUser, Currency, CurrencyCode } from '@baseline/host-contract';
import { z } from 'zod';

/** The remotes the shell knows how to host. Adding one means a route, a panel and an entry here. */
export const REMOTE_NAMES = ['people', 'delivery'] as const;
export type RemoteName = (typeof REMOTE_NAMES)[number];

/** A URL to a remote's `remoteEntry.js`, absolute or relative to the shell's origin. */
const RemoteUrl = z.string().min(1);

/**
 * `/config.json`, written by the shell container's entrypoint at start (ADR 029 §9). Remote URLs
 * live here and never in the bundle, so one build can point at any deployment.
 */
export const ShellConfig = z
  .object({
    remotes: z.object({ people: RemoteUrl, delivery: RemoteUrl }),
    currencies: z.array(Currency).min(1),
    defaultCurrency: CurrencyCode,
    users: z.array(ActiveUser).min(1),
  })
  .refine((config) => config.currencies.some((currency) => currency.code === config.defaultCurrency), {
    message: 'defaultCurrency must be one of currencies',
    path: ['defaultCurrency'],
  });
export type ShellConfig = z.infer<typeof ShellConfig>;
