import type { ActiveUser, Currency } from '@baseline/host-contract';
import type { ShellConfig } from './schema';

export interface Selection {
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}

/** The currency and user the shell starts with: the configured default currency and the first user. */
export function initialSelection(config: ShellConfig): Selection {
  const currency = config.currencies.find((candidate) => candidate.code === config.defaultCurrency);
  const [activeUser] = config.users;
  // The schema guarantees both; this keeps the types honest under noUncheckedIndexedAccess.
  if (!currency || !activeUser) throw new Error('config.json has no usable default currency or user');
  return { currency, activeUser };
}
