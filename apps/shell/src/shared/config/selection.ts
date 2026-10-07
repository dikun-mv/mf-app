import type { ActiveUser, Currency } from '@baseline/host-contract';
import { z } from 'zod';
import type { ShellConfig } from './schema';

export interface Selection {
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
}

/** The versioned key (`.v1`), so a later change to the stored shape can ignore old values instead of misreading them. */
export const SELECTION_KEY = 'baseline.shell.selection.v1';

/** What is stored: the two choices by code and id only, never the rate or the name, which `config.json` owns. */
const StoredSelection = z.object({ currency: z.string().optional(), userId: z.string().optional() });

/** The slice of `Storage` the shell uses, so tests can pass a fake. */
export type SelectionStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readStored(storage: SelectionStorage): z.infer<typeof StoredSelection> {
  try {
    const raw = storage.getItem(SELECTION_KEY);
    const parsed = StoredSelection.safeParse(raw === null ? null : JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    // Storage that is blocked, or text that is not JSON: start from the defaults.
    return {};
  }
}

/**
 * The currency and user the shell starts with: the stored choices where `config.json` still lists
 * them, otherwise the configured default currency and the first user.
 */
export function initialSelection(config: ShellConfig, storage: SelectionStorage): Selection {
  const stored = readStored(storage);
  const currency =
    config.currencies.find((candidate) => candidate.code === stored.currency) ??
    config.currencies.find((candidate) => candidate.code === config.defaultCurrency);
  const activeUser = config.users.find((candidate) => candidate.id === stored.userId) ?? config.users[0];
  // The schema guarantees both; this keeps the types honest under noUncheckedIndexedAccess.
  if (!currency || !activeUser) throw new Error('config.json has no usable default currency or user');
  return { currency, activeUser };
}

/** Keeps the choices across a reload. A full or blocked storage only loses persistence, so it is ignored. */
export function storeSelection(selection: Selection, storage: SelectionStorage): void {
  try {
    storage.setItem(
      SELECTION_KEY,
      JSON.stringify({ currency: selection.currency.code, userId: selection.activeUser.id }),
    );
  } catch {
    // Nothing to do: the choice still applies until the page is reloaded.
  }
}

/** The page's `localStorage`, or a storage that keeps nothing when the browser blocks access to it. */
export function browserStorage(): SelectionStorage {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}
