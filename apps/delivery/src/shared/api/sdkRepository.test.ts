import { EMPTY_CHANGE_SET } from '@baseline/delivery-domain';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { z } from 'zod';
import { allocation, asPocketBase, item } from '../testing';
import { RepositoryError } from './errors';
import { createClients, createSdkRepository, parseRealtimeEvent } from './sdkRepository';

// The SDK's `fetch` is the only thing stubbed: the repository, the SDK's request building and its error
// handling run for real, against canned answers. No server, no network.

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

let calls: Call[] = [];

/** A batch goes out as form data with its JSON in `@jsonPayload`; other writes are plain JSON. */
function bodyOf(body: RequestInit['body']): unknown {
  const text = body instanceof FormData ? body.get('@jsonPayload') : body;
  return typeof text === 'string' ? (JSON.parse(text) as unknown) : undefined;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers the next requests in order with `answers`; each is a Response, or an Error for a request that never arrived. */
function answerWith(...answers: (Response | Error)[]): void {
  const queue = [...answers];
  rs.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({
      url: decodeURIComponent(url),
      method: init.method ?? 'GET',
      body: bodyOf(init.body),
    });
    const answer = queue.shift();
    if (answer === undefined) return Promise.reject(new Error('No answer left for this request'));
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
}

const page = (items: unknown[]) => json(200, { page: 1, perPage: 500, totalItems: -1, totalPages: -1, items });

const repository = () => createSdkRepository(createClients('http://gateway.test'));

const BATCH_BODY = z.object({ requests: z.array(z.object({ method: z.string(), url: z.string() })) });

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  rs.unstubAllGlobals();
});

describe('list', () => {
  it('reads Delivery’s collection through its base path, in insertion order, and parses it', async () => {
    answerWith(
      page([
        asPocketBase('breakdown_items', { id: 'wbs-1', projectId: 'prj-1', parentId: '', name: 'Root' }),
        asPocketBase('breakdown_items', { id: 'wbs-2', projectId: 'prj-1', parentId: 'wbs-1', name: 'Leaf' }),
      ]),
    );
    const items = await repository().list('breakdownItems');
    expect(items).toEqual([item('wbs-1', 'prj-1', null, 'Root'), item('wbs-2', 'prj-1', 'wbs-1', 'Leaf')]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('http://gateway.test/api/delivery/api/collections/breakdown_items/records');
    expect(calls[0]?.url).toContain('sort=@rowid');
  });

  it('reads People’s collections from People’s instance', async () => {
    answerWith(
      page([asPocketBase('employees', { id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 })]),
    );
    const employees = await repository().list('employees');
    expect(employees).toEqual([{ id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 }]);
    expect(calls[0]?.url).toContain('http://gateway.test/api/people/api/collections/employees/records');
  });

  it('logs and skips a record that does not parse, and keeps the rest', async () => {
    const logged = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    answerWith(
      page([
        asPocketBase('employees', { id: 'emp-001', name: '', role: 'Tech Lead', weeklyHours: 40 }),
        asPocketBase('employees', { id: 'emp-002', name: 'Ben Ito', role: 'Engineer', weeklyHours: 32 }),
      ]),
    );
    const employees = await repository().list('employees');
    expect(employees).toEqual([{ id: 'emp-002', name: 'Ben Ito', role: 'Engineer', weeklyHours: 32 }]);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });

  it('fails with unavailable when the service gives no answer, or the gateway answers 502', async () => {
    answerWith(new TypeError('fetch failed'), json(502, { message: 'Bad gateway' }));
    await expect(repository().list('projects')).rejects.toMatchObject({ code: 'unavailable', instance: 'delivery' });
    await expect(repository().list('projects')).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('applyChangeSet', () => {
  it('sends nothing for an empty change set', async () => {
    answerWith();
    expect(await repository().applyChangeSet(EMPTY_CHANGE_SET)).toEqual({ items: [], allocations: [] });
    expect(calls).toEqual([]);
  });

  it('sends every write as one batch, in the order the server needs, and returns what the server holds', async () => {
    const created = item('wbs-9', 'prj-1', 'wbs-1', 'New');
    const moved = allocation('alloc-1', 'wbs-9', 'emp-001', '2026-03', 1);
    answerWith(
      json(200, [
        { status: 204, body: null },
        { status: 200, body: asPocketBase('breakdown_items', created) },
        { status: 200, body: asPocketBase('allocations', { ...moved, editedAt: '2026-05-01T10:00:00.000Z' }) },
      ]),
    );

    const result = await repository().applyChangeSet({
      create: { items: [created], allocations: [] },
      update: { items: [], allocations: [moved] },
      delete: { itemIds: [], allocationIds: [allocation('alloc-2', 'wbs-2', 'emp-001', '2026-03', 1).id] },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'http://gateway.test/api/delivery/api/batch' });
    const { requests } = BATCH_BODY.parse(calls[0]?.body);
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'DELETE /api/collections/allocations/records/alloc-2',
      'POST /api/collections/breakdown_items/records',
      'PATCH /api/collections/allocations/records/alloc-1',
    ]);
    expect(result.items).toEqual([created]);
    expect(result.allocations).toEqual([{ ...moved, editedAt: '2026-05-01T10:00:00.000Z' }]);
  });

  it('maps a refused batch with a unique-index clash to conflict', async () => {
    const clash = { code: 'validation_not_unique', message: 'Value must be unique.' };
    answerWith(
      json(400, {
        status: 400,
        message: 'Batch transaction failed.',
        data: {
          requests: {
            '0': {
              code: 'batch_request_failed',
              message: 'Batch request failed.',
              response: { status: 400, message: 'Failed to create record.', data: { month: clash, employeeId: clash } },
            },
          },
        },
      }),
    );
    await expect(
      repository().applyChangeSet({
        ...EMPTY_CHANGE_SET,
        create: { items: [], allocations: [allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 1)] },
      }),
    ).rejects.toMatchObject({ code: 'conflict', instance: 'delivery' });
  });

  it('fails with invalidData when the server’s answer is not a record of the collection', async () => {
    const created = item('wbs-9', 'prj-1', null, 'New');
    answerWith(json(200, [{ status: 200, body: asPocketBase('allocations', created) }]));
    await expect(
      repository().applyChangeSet({ ...EMPTY_CHANGE_SET, create: { items: [created], allocations: [] } }),
    ).rejects.toMatchObject({ code: 'invalidData' });
  });
});

describe('parseRealtimeEvent', () => {
  const stored = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

  it('parses the record of a create, an update and a delete', () => {
    for (const action of ['create', 'update', 'delete'] as const) {
      expect(parseRealtimeEvent('allocations', { action, record: asPocketBase('allocations', stored) })).toEqual({
        action,
        record: stored,
      });
    }
  });

  it('reads a root’s empty parent as null', () => {
    const event = {
      action: 'create',
      record: asPocketBase('breakdown_items', { id: 'wbs-1', projectId: 'prj-1', parentId: '', name: 'Root' }),
    };
    expect(parseRealtimeEvent('breakdownItems', event)).toEqual({
      action: 'create',
      record: item('wbs-1', 'prj-1', null, 'Root'),
    });
  });

  it('logs and drops an event that does not parse, or has an action it does not know', () => {
    const logged = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(
      parseRealtimeEvent('allocations', {
        action: 'create',
        record: asPocketBase('allocations', { ...stored, amount: -1 }),
      }),
    ).toBeNull();
    expect(
      parseRealtimeEvent('allocations', { action: 'create', record: asPocketBase('projects', stored) }),
    ).toBeNull();
    expect(
      parseRealtimeEvent('allocations', { action: 'truncate', record: asPocketBase('allocations', stored) }),
    ).toBeNull();
    expect(logged).toHaveBeenCalledTimes(3);
    logged.mockRestore();
  });
});
