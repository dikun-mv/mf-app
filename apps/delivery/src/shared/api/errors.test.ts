import { describe, expect, it } from '@rstest/core';
import { ClientResponseError } from 'pocketbase';
import { z } from 'zod';
import { describeError, mapError, RepositoryError } from './errors';

const refused = (status: number, response: object = {}) => new ClientResponseError({ status, response });

// PocketBase's bodies from ADR 033 h.
const fieldClash = (field: string, code: string) => ({
  status: 400,
  message: 'Failed to create record.',
  data: { [field]: { code, message: '…' } },
});
const batchRefusal = (index: number, response: object) => ({
  status: 400,
  message: 'Batch transaction failed.',
  data: { requests: { [String(index)]: { code: 'batch_request_failed', message: '…', response } } },
});

describe('mapError', () => {
  it('maps a request that got no answer, and a gateway that cannot reach the service, to unavailable', () => {
    expect(mapError(refused(0), 'delivery').code).toBe('unavailable');
    expect(mapError(refused(502), 'delivery').code).toBe('unavailable');
    expect(mapError(refused(503), 'people').code).toBe('unavailable');
    expect(mapError(refused(504), 'delivery').code).toBe('unavailable');
  });

  it('maps 404 to notFound', () => {
    expect(
      mapError(refused(404, { status: 404, message: "The requested resource wasn't found.", data: {} }), 'delivery')
        .code,
    ).toBe('notFound');
  });

  it('maps a field violation to validation', () => {
    const error = refused(400, fieldClash('month', 'validation_invalid_format'));
    expect(mapError(error, 'delivery').code).toBe('validation');
  });

  it('maps a unique-index clash, on any of its columns, to conflict', () => {
    const clash = {
      status: 400,
      message: 'Failed to create record.',
      data: {
        breakdownItemId: { code: 'validation_not_unique' },
        employeeId: { code: 'validation_not_unique' },
        month: { code: 'validation_not_unique' },
      },
    };
    expect(mapError(refused(400, clash), 'delivery').code).toBe('conflict');
  });

  it('maps a duplicate client-generated id to conflict, but only on the id field', () => {
    expect(mapError(refused(400, fieldClash('id', 'validation_pk_invalid')), 'delivery').code).toBe('conflict');
    expect(mapError(refused(400, fieldClash('name', 'validation_pk_invalid')), 'delivery').code).toBe('validation');
  });

  it('finds the clash inside the failing operation of a batch', () => {
    const clash = fieldClash('id', 'validation_pk_invalid');
    expect(mapError(refused(400, batchRefusal(1, clash)), 'delivery').code).toBe('conflict');
    const invalid = fieldClash('month', 'validation_invalid_format');
    expect(mapError(refused(400, batchRefusal(1, invalid)), 'delivery').code).toBe('validation');
  });

  it('maps a 400 whose body it cannot read to validation, and other statuses to server', () => {
    expect(mapError(refused(400, { unexpected: true }), 'delivery').code).toBe('validation');
    expect(mapError(refused(400, { data: { month: 'not an object' } }), 'delivery').code).toBe('validation');
    expect(mapError(refused(500), 'delivery').code).toBe('server');
    expect(mapError(refused(403), 'delivery').code).toBe('server');
    expect(mapError(new TypeError('boom'), 'delivery').code).toBe('server');
  });

  it('maps a record that does not parse to invalidData', () => {
    const failure = z.object({ name: z.string() }).safeParse({});
    if (failure.success) throw new Error('expected a parse failure');
    expect(mapError(failure.error, 'people').code).toBe('invalidData');
  });

  it('keeps the instance and the cause, and passes a RepositoryError through', () => {
    const cause = refused(404);
    const mapped = mapError(cause, 'people');
    expect(mapped).toBeInstanceOf(RepositoryError);
    expect(mapped.instance).toBe('people');
    expect(mapped.cause).toBe(cause);
    expect(mapError(mapped, 'delivery')).toBe(mapped);
  });
});

describe('describeError', () => {
  it.each([
    ['unavailable', 'delivery', "the Delivery service didn't respond"],
    ['unavailable', 'people', "the People service didn't respond"],
    ['conflict', 'delivery', 'the data was changed elsewhere'],
    ['notFound', 'delivery', "the record doesn't exist any more"],
    ['validation', 'delivery', 'the Delivery service refused the data'],
    ['invalidData', 'people', "the People service sent data this page can't read"],
    ['server', 'delivery', 'the Delivery service reported an error'],
  ] as const)('says what a %s error from %s means', (code, instance, text) => {
    expect(describeError(new RepositoryError(code, instance))).toBe(text);
  });

  it('has something to say about any other error', () => {
    expect(describeError(new Error('boom'))).toBe('something went wrong');
  });
});
