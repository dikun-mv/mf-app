import { describe, expect, it } from '@rstest/core';
import { ClientResponseError } from 'pocketbase';
import {
  ApiError,
  CONFLICT_MESSAGE,
  describeError,
  describeWriteFailure,
  isConflictError,
  toApiError,
  type ApiErrorCode,
} from './errors';

// The bodies are the ones ADR 033 (h) recorded from the pinned PocketBase.

const failure = (status: number, response: object): ClientResponseError =>
  new ClientResponseError({ url: 'http://pb.test/api/people/api/batch', status, response });

const field = (code: string) => ({ code, message: 'x' });

/** A batch that failed on its operation `index`, the way PocketBase nests it. */
const batchFailure = (index: number, status: number, data: object): ClientResponseError =>
  failure(400, {
    status: 400,
    message: 'Batch transaction failed.',
    data: {
      requests: {
        [String(index)]: {
          code: 'batch_request_failed',
          message: 'Batch request failed.',
          response: { status, message: 'Failed to create record.', data },
        },
      },
    },
  });

describe('toApiError', () => {
  it.each<[string, ClientResponseError, ApiErrorCode]>([
    [
      'a field violation',
      failure(400, { status: 400, data: { hourlyCost: field('validation_required') } }),
      'validation',
    ],
    [
      'a unique-index failure on every column of the index',
      failure(400, {
        status: 400,
        data: { employeeId: field('validation_not_unique'), validFrom: field('validation_not_unique') },
      }),
      'conflict',
    ],
    [
      'a duplicate client-generated id',
      failure(400, { status: 400, data: { id: field('validation_pk_invalid') } }),
      'conflict',
    ],
    [
      'a malformed id, which is not a clash',
      failure(400, { status: 400, data: { id: field('validation_invalid_format') } }),
      'validation',
    ],
    [
      'a unique-index failure inside a batch',
      batchFailure(1, 400, { validFrom: field('validation_not_unique') }),
      'conflict',
    ],
    ['a batch operation on a record that is gone', batchFailure(0, 404, {}), 'notFound'],
    [
      'a field violation inside a batch',
      batchFailure(0, 400, { validFrom: field('validation_invalid_format') }),
      'validation',
    ],
    [
      'a missing record',
      failure(404, { status: 404, message: "The requested resource wasn't found.", data: {} }),
      'notFound',
    ],
    ['no answer at all', failure(0, {}), 'unavailable'],
    [
      'the gateway with its upstream down',
      failure(502, '<html>Bad Gateway</html>' as unknown as object),
      'unavailable',
    ],
    ['a server error', failure(500, { status: 500, data: {} }), 'server'],
    [
      'a locked rule',
      failure(403, { status: 403, message: 'Only superusers can perform this action.', data: {} }),
      'server',
    ],
  ])('maps %s to %s', (_name, error, code) => {
    const mapped = toApiError(error, 'people');
    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped).toMatchObject({ code, service: 'people' });
  });

  it('keeps the SDK error as the cause', () => {
    const error = failure(500, { status: 500, data: {} });
    expect((toApiError(error, 'people') as ApiError).cause).toBe(error);
  });

  it('passes on anything that is not an SDK error, so a bug reaches the error boundary as it is', () => {
    const bug = new TypeError('x is undefined');
    expect(toApiError(bug, 'people')).toBe(bug);
  });

  it('returns an ApiError unchanged', () => {
    const error = new ApiError('conflict', 'delivery');
    expect(toApiError(error, 'people')).toBe(error);
  });
});

describe('describeError', () => {
  it.each<[ApiErrorCode, string]>([
    ['unavailable', "the People service didn't respond"],
    ['server', 'the People service reported an error'],
    ['conflict', 'the data was changed elsewhere'],
    ['notFound', 'the record no longer exists'],
    ['validation', 'the People service refused the data'],
  ])('says what %s means', (code, text) => {
    expect(describeError(new ApiError(code, 'people'))).toBe(text);
  });

  it("names the Delivery service for Delivery's feed", () => {
    expect(describeError(new ApiError('unavailable', 'delivery'))).toBe("the Delivery service didn't respond");
  });

  it('does not guess at an error it does not know', () => {
    expect(describeError(new TypeError('x'))).toBe('something went wrong');
  });
});

describe('describeWriteFailure', () => {
  it('says the change was undone, and to try again when the service did not answer', () => {
    expect(describeWriteFailure(new ApiError('unavailable', 'people'))).toBe(
      "Your change wasn't saved: the People service didn't respond. It has been undone. Try again when the connection is back.",
    );
  });

  it('does not suggest trying again after an error that the same change would repeat', () => {
    expect(describeWriteFailure(new ApiError('server', 'people'))).toBe(
      "Your change wasn't saved: the People service reported an error. It has been undone.",
    );
    expect(describeWriteFailure(new TypeError('x'))).toBe(
      "Your change wasn't saved: something went wrong. It has been undone.",
    );
  });

  it('says the data changed for a conflict', () => {
    const conflict = new ApiError('conflict', 'people');
    expect(isConflictError(conflict)).toBe(true);
    expect(isConflictError(new ApiError('server', 'people'))).toBe(false);
    expect(describeWriteFailure(conflict)).toBe(CONFLICT_MESSAGE);
  });
});
