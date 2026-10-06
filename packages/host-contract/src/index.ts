import { z } from 'zod';

// Shared primitives (T1.1). Dates and months cross every boundary as strings: the
// delivery-domain calendar module is the only place they become `Date` objects (D20).

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** A calendar day, `YYYY-MM-DD`. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, 'not a calendar date')
  .brand<'IsoDate'>();
export type IsoDate = z.infer<typeof IsoDate>;

/**
 * An instant in UTC as `Date.prototype.toISOString()` writes it. Its fixed length means string
 * comparison sorts by time, which the capacity causer rule relies on (D18).
 */
export const IsoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/)
  .refine(isCalendarDate, 'not a calendar date')
  .brand<'IsoDateTime'>();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** A calendar month, `YYYY-MM`. */
export const Month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .brand<'Month'>();
export type Month = z.infer<typeof Month>;

/** An ISO 4217 currency code. */
export const CurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .brand<'CurrencyCode'>();
export type CurrencyCode = z.infer<typeof CurrencyCode>;

const SEED_SUFFIX = '\\d+';
const UUID_SUFFIX = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Builds the schema for an id like `wbs-012` (a seed id) or `wbs-<uuid>` (a client-generated one):
 * `entityId('emp', 'EmployeeId')`. The brand exists only in the type.
 */
export function entityId<B extends string>(prefix: string, _brand: B) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}-(${SEED_SUFFIX}|${UUID_SUFFIX})$`))
    .brand<B>();
}

/** A user the shell can act as. Auth isn't scored, so this is only a name to show and stamp. */
export const UserId = entityId('user', 'UserId');
export type UserId = z.infer<typeof UserId>;

export const ActiveUser = z.object({ id: UserId, name: z.string().min(1) });
export type ActiveUser = z.infer<typeof ActiveUser>;

/** A display currency. Rates are stored in EUR, so `perEur` is units of this currency per 1 EUR (D11). */
export const Currency = z.object({ code: CurrencyCode, perEur: z.number().positive() });
export type Currency = z.infer<typeof Currency>;

/**
 * The URL path an app's router is mounted under: `''` (the origin root) or segments like
 * `/people`, never with a trailing slash. It is what React Router takes as `basename` (D22).
 */
export const BasePath = z
  .string()
  .regex(/^(\/[A-Za-z0-9._~-]+)*$/)
  .brand<'BasePath'>();
export type BasePath = z.infer<typeof BasePath>;

/**
 * Everything the shell pushes into a remote (D10, D11, D22). It is plain data plus one function, and
 * this package has no React dependency: the shell types a loaded `./App` as
 * `ComponentType<RemoteAppProps>` and each remote types its own `App` the same way.
 */
export interface HostContext {
  readonly currency: Currency;
  readonly activeUser: ActiveUser;
  /** The path the remote's router is mounted under. Fixed for the life of a mount. */
  readonly basePath: BasePath;
  /**
   * Navigates to an absolute URL path anywhere in the host. A remote's own navigation stays under
   * `basePath` and goes through its router; anything outside it goes through here. Hosted, the shell
   * follows a navigation with a `popstate` event so a mounted remote's router re-reads the URL.
   * Standalone, it opens the other app's standalone URL.
   */
  readonly navigate: (to: string) => void;
}

/** The props of a remote's exposed `./App` component. */
export interface RemoteAppProps {
  readonly ctx: HostContext;
}

/** What `mount` returns: push a new context in without remounting, or tear the app down. */
export interface RemoteHandle {
  update(ctx: HostContext): void;
  unmount(): void;
}

/** The shape of a remote's exposed `./mount` (D10): the framework-agnostic seam. */
export interface RemoteModule {
  mount(el: HTMLElement, ctx: HostContext): RemoteHandle;
}
