import { ClientResponseError } from 'pocketbase';
import { z } from 'zod';

/**
 * What went wrong with a request, in the codes plan §3 names (400 validation, 404 missing, a unique-index or
 * duplicate-id failure as conflict), plus the two failures that say nothing about the data: the service
 * didn't answer, or answered with a server error. Mapped in one place, `toApiError` (D33).
 */
export type ApiErrorCode = 'validation' | 'notFound' | 'conflict' | 'unavailable' | 'server';

/** The PocketBase instance a request went to, so the message can name the service. */
export type ServiceName = 'people' | 'delivery';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: ApiErrorCode,
    readonly service: ServiceName,
    options?: { readonly cause?: unknown },
  ) {
    super(`${service} request failed: ${code}`, options);
  }
}

// PocketBase's error body (ADR 033 h): `{ status, message, data }`. `data` maps a field to `{ code, message }`.
// Inside a batch, `data.requests.<index>.response` holds the failing operation's own body.
const FieldIssue = z.object({ code: z.string() });
const Failure = z.object({ status: z.number().optional(), data: z.record(z.string(), z.unknown()).optional() });
const BatchData = z.object({ requests: z.record(z.string(), z.object({ response: Failure.optional() })) });

interface Failed {
  readonly status: number;
  /** `[field, PocketBase validation code]` pairs. */
  readonly issues: readonly (readonly [string, string])[];
}

function issuesOf(data: Record<string, unknown> | undefined): Failed['issues'] {
  return Object.entries(data ?? {}).flatMap(([field, value]) => {
    const issue = FieldIssue.safeParse(value);
    return issue.success ? [[field, issue.data.code] as const] : [];
  });
}

/** The response itself, then each failing operation of a batch. */
function failuresOf(error: ClientResponseError): Failed[] {
  const body = Failure.safeParse(error.response);
  const data = body.success ? body.data.data : undefined;
  const own: Failed = { status: error.status, issues: issuesOf(data) };
  const batch = BatchData.safeParse(data);
  const nested = batch.success
    ? Object.values(batch.data.requests).flatMap(({ response }) =>
        response ? [{ status: response.status ?? 0, issues: issuesOf(response.data) }] : [],
      )
    : [];
  return [own, ...nested];
}

// A unique-index failure reports every column of the index (`validation_not_unique`); a duplicate id is
// `validation_pk_invalid` on `id`, a different code from a malformed one (ADR 033 h).
const isConflict = ({ issues }: Failed): boolean =>
  issues.some(
    ([field, code]) => code === 'validation_not_unique' || (field === 'id' && code === 'validation_pk_invalid'),
  );

/** No answer at all (status 0) or the gateway saying its upstream is down. */
const isUnavailable = (status: number): boolean => status === 0 || status === 502 || status === 503 || status === 504;

function codeOf(error: ClientResponseError): ApiErrorCode {
  const failures = failuresOf(error);
  if (failures.some(isConflict)) return 'conflict';
  if (failures.some(({ status }) => status === 404)) return 'notFound';
  if (isUnavailable(error.status)) return 'unavailable';
  if (error.status === 400) return 'validation';
  return 'server';
}

/**
 * The one place an SDK error becomes an `ApiError`. Anything that isn't a `ClientResponseError` (a record
 * that fails its schema, a bug) is passed on as it is, so the page's error boundary shows it.
 */
export function toApiError(error: unknown, service: ServiceName): unknown {
  if (error instanceof ApiError) return error;
  if (error instanceof ClientResponseError) return new ApiError(codeOf(error), service, { cause: error });
  return error;
}

const SERVICE_LABEL = { people: 'People', delivery: 'Delivery' } as const satisfies Record<ServiceName, string>;

/**
 * The cause of a failure as a phrase for a sentence such as "Employees couldn't be loaded: <cause>."
 * (screens 4). One function turns codes into text, so the wording stays consistent (D33).
 */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'something went wrong';
  const service = SERVICE_LABEL[error.service];
  switch (error.code) {
    case 'unavailable':
      return `the ${service} service didn't respond`;
    case 'server':
      return `the ${service} service reported an error`;
    case 'conflict':
      return 'the data was changed elsewhere';
    case 'notFound':
      return 'the record no longer exists';
    case 'validation':
      return `the ${service} service refused the data`;
  }
}

/** The server refused a write because the data changed under it (a rate starting the same day was added elsewhere). */
export const isConflictError = (error: unknown): boolean => error instanceof ApiError && error.code === 'conflict';

/** What a conflict says (screens 4): the affected collections have been refetched, so the user can look again. */
export const CONFLICT_MESSAGE = 'This data was changed elsewhere and has been reloaded. Check it and try again.';

/**
 * What a failed write says (screens 4, D33): the change was not saved and has been undone. A conflict says the
 * data changed instead. Only a failure to reach the service suggests trying again, because only then can the
 * same change succeed later.
 */
export function describeWriteFailure(error: unknown): string {
  if (isConflictError(error)) return CONFLICT_MESSAGE;
  const retry =
    error instanceof ApiError && error.code === 'unavailable' ? ' Try again when the connection is back.' : '';
  return `Your change wasn't saved: ${describeError(error)}. It has been undone.${retry}`;
}
