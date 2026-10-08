import { ClientResponseError } from 'pocketbase';
import { z } from 'zod';
import type { Instance } from './collections';

/**
 * What went wrong with a request, in the codes the app switches over (plan §3, request flow, step 4):
 * 400 `validation`, 404 `notFound`, a unique-index clash or a duplicate client-generated id `conflict`
 * (ADR 033 h), a service that can't be reached `unavailable`, any other 5xx or refusal `server`, and a
 * write whose answer doesn't parse as its record `invalidData` (a read skips such records instead).
 */
export type RepositoryErrorCode = 'validation' | 'notFound' | 'conflict' | 'unavailable' | 'server' | 'invalidData';

/** The one error the repository throws, whatever the SDK or zod threw underneath. */
export class RepositoryError extends Error {
  constructor(
    readonly code: RepositoryErrorCode,
    readonly instance: Instance,
    options?: ErrorOptions,
  ) {
    super(`${instance} request failed: ${code}`, options);
    this.name = 'RepositoryError';
  }
}

// PocketBase's error body (ADR 033 h): `data.<field> = { code }` for a refused record, and for a refused
// batch `data.requests.<index>.response.data.<field> = { code }` for each failing operation.
const FieldError = z.object({ code: z.string() });
const FieldErrors = z.object({ data: z.record(z.string(), z.unknown()) });
const BatchErrors = z.object({
  data: z.object({ requests: z.record(z.string(), z.object({ response: FieldErrors })) }),
});

interface FieldCode {
  readonly field: string;
  readonly code: string;
}

function fieldCodes(response: unknown): FieldCode[] {
  const codesIn = (body: z.infer<typeof FieldErrors>): FieldCode[] =>
    Object.entries(body.data).flatMap(([field, value]) => {
      const error = FieldError.safeParse(value);
      return error.success ? [{ field, code: error.data.code }] : [];
    });
  const direct = FieldErrors.safeParse(response);
  const batch = BatchErrors.safeParse(response);
  return [
    ...(direct.success ? codesIn(direct.data) : []),
    ...(batch.success
      ? Object.values(batch.data.data.requests).flatMap(({ response: failed }) => codesIn(failed))
      : []),
  ];
}

/** A unique-index clash on any field, or a duplicate record id: another writer got there first (ADR 033 h). */
const isConflict = ({ field, code }: FieldCode): boolean =>
  code === 'validation_not_unique' || (field === 'id' && code === 'validation_pk_invalid');

/** A gateway that can't reach the service answers 502, 503 or 504. */
const GATEWAY_DOWN: readonly number[] = [502, 503, 504];

/**
 * Turns whatever a call threw into a `RepositoryError`, in this one place. A status of 0 is the SDK's
 * word for a request that never got an answer (offline, refused, aborted).
 */
export function mapError(error: unknown, instance: Instance): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const cause = { cause: error };
  if (error instanceof z.ZodError) return new RepositoryError('invalidData', instance, cause);
  if (error instanceof ClientResponseError) {
    const { status } = error;
    if (status === 0 || GATEWAY_DOWN.includes(status)) return new RepositoryError('unavailable', instance, cause);
    if (status === 404) return new RepositoryError('notFound', instance, cause);
    if (status === 400) {
      const conflict = fieldCodes(error.response).some(isConflict);
      return new RepositoryError(conflict ? 'conflict' : 'validation', instance, cause);
    }
  }
  return new RepositoryError('server', instance, cause);
}

const SERVICE_NAME = { delivery: 'Delivery', people: 'People' } as const satisfies Record<Instance, string>;

/**
 * The reason an action failed, as a clause that fits after a colon ("Projects couldn't be loaded: …"), and
 * the one place that turns codes into text (D33). It names the service when the user can act on that.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof RepositoryError)) return 'something went wrong';
  const service = `the ${SERVICE_NAME[error.instance]} service`;
  switch (error.code) {
    case 'unavailable':
      return `${service} didn't respond`;
    case 'conflict':
      return 'the data was changed elsewhere';
    case 'notFound':
      return "the record doesn't exist any more";
    case 'validation':
      return `${service} refused the data`;
    case 'invalidData':
      return `${service} sent data this page can't read`;
    case 'server':
      return `${service} reported an error`;
  }
}
