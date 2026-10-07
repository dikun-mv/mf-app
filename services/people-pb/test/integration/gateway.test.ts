import { PEOPLE_BASE_PATH } from '@baseline/people-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import { createClient, GATEWAY } from './setup';

// What the gateway forwards to People's PocketBase under /api/people/ (ADR 031): an allowlist. The SDK's
// own paths (health, batch, the records routes and realtime) work; PocketBase's superuser and admin API,
// the schema and auth routes, `_` system collections and the dashboard answer the gateway's JSON 404.
// Tests go through `GATEWAY` with the SDK where the SDK has a call, and with plain `fetch` otherwise.
const pb = createClient();
const rates = pb.collection('rate_records');
const BASE = `${GATEWAY}${PEOPLE_BASE_PATH}`;

/** The gateway's own 404 body, which PocketBase never produces. */
const GATEWAY_NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'No such API route' } };

/** Far from the seed's dates (2025-2026), so a new record never clashes with one. */
const FUTURE = '2041-01-01';

const created: string[] = [];
const newId = (): string => {
  const id = `rate-${crypto.randomUUID()}`;
  created.push(id);
  return id;
};

afterEach(async () => {
  for (const id of created.splice(0)) await rates.delete(id).catch(() => undefined);
});

describe('the allowed routes', () => {
  it('answers the health check', async () => {
    expect(await pb.health.check()).toMatchObject({ code: 200 });
  });

  it('lists records, with a filter and a sort in the query string', async () => {
    const page = await pb.collection('employees').getList(1, 5, {
      filter: pb.filter('id = {:a} || id = {:b}', { a: 'emp-001', b: 'emp-002' }),
      sort: '-id',
    });
    expect(page.items.map((r) => r.id)).toEqual(['emp-002', 'emp-001']);
    expect(page.totalItems).toBe(2);
  });

  it('passes the query string through untouched', async () => {
    // `%27` and `%25` are a quote and a percent sign. A gateway that decoded the query twice would break them.
    const response = await fetch(`${BASE}/api/collections/employees/records?filter=id%3D%27emp-001%27&perPage=1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalItems: 1, perPage: 1 });
    const percent = await fetch(`${BASE}/api/collections/employees/records?filter=name~%27100%25%27`);
    expect(percent.status).toBe(200);
    expect(await percent.json()).toMatchObject({ totalItems: 0 });
  });

  it('reads one record', async () => {
    expect(await pb.collection('employees').getOne('emp-001')).toMatchObject({ id: 'emp-001' });
  });

  it('creates, updates and deletes a record', async () => {
    const id = newId();
    await rates.create({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    await rates.update(id, { hourlyCost: 75 });
    expect(await rates.getOne(id)).toMatchObject({ hourlyCost: 75 });
    await rates.delete(id);
    await expect(rates.getOne(id)).rejects.toMatchObject({ status: 404 });
  });

  it('sends a batch', async () => {
    const [first, second] = [newId(), newId()];
    const batch = pb.createBatch();
    batch.collection('rate_records').create({ id: first, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    batch.collection('rate_records').create({ id: second, employeeId: 'emp-003', validFrom: FUTURE, hourlyCost: 71 });
    expect((await batch.send()).map((r) => r.status)).toEqual([200, 200]);
    expect(await rates.getOne(second)).toMatchObject({ hourlyCost: 71 });
  });

  it('opens the realtime stream', async () => {
    const controller = new AbortController();
    try {
      const response = await fetch(`${BASE}/api/realtime`, { signal: controller.signal });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const chunk = await response.body?.getReader().read();
      // The first event arrives at once, not when a buffer fills.
      expect(new TextDecoder().decode(chunk?.value)).toContain('PB_CONNECT');
    } finally {
      controller.abort();
    }
  });
});

describe('the blocked routes', () => {
  const blocked: [method: string, path: string][] = [
    // PocketBase's admin API.
    ['GET', '/api/settings'],
    ['PATCH', '/api/settings'],
    ['GET', '/api/logs'],
    ['GET', '/api/backups'],
    ['POST', '/api/backups'],
    ['GET', '/api/crons'],
    // The schema routes.
    ['GET', '/api/collections'],
    ['POST', '/api/collections'],
    ['GET', '/api/collections/employees'],
    ['DELETE', '/api/collections/employees'],
    ['PUT', '/api/collections/import'],
    // System collections start with `_`.
    ['GET', '/api/collections/_superusers/records'],
    ['POST', '/api/collections/_superusers/records'],
    ['GET', '/api/collections/_superusers/records/anyone'],
    ['POST', '/api/collections/_superusers/auth-with-password'],
    ['GET', '/api/collections/_pb_users_auth_/records'],
    // A collection reached by its id (the system collections have `pbc_…` ids), PocketBase's default `users`
    // collection, a made-up name, and the other service's collection: only this instance's own are routed.
    ['GET', '/api/collections/pbc_3142635823/records'],
    ['GET', '/api/collections/pbc_3142635823/records/anyone'],
    ['GET', '/api/collections/users/records'],
    ['POST', '/api/collections/users/records'],
    ['GET', '/api/collections/users/records/anyone'],
    ['GET', '/api/collections/no_such_collection/records'],
    ['GET', '/api/collections/projects/records'],
    // Auth routes of any collection.
    ['POST', '/api/collections/employees/auth-with-password'],
    ['POST', '/api/collections/employees/auth-refresh'],
    ['GET', '/api/collections/employees/auth-methods'],
    // Not a records route: a trailing slash, a longer path, an upper-case name, a slash inside an id.
    ['GET', '/api/collections/employees/records/'],
    ['GET', '/api/collections/employees/records/emp-001/extra'],
    ['GET', '/api/collections/Employees/records'],
    ['GET', '/api/collections/employees/records/a%2Fb'],
    // Files, and the dashboard.
    ['GET', '/api/files/employees/emp-001/photo.png'],
    ['GET', '/_/'],
    ['GET', '/_/index.html'],
    ['GET', '/'],
  ];

  it.each(blocked)('answers %s %s with the gateway JSON 404', async (method, path) => {
    const response = await fetch(`${BASE}${path}`, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(GATEWAY_NOT_FOUND);
  });
});

describe('an encoded path', () => {
  it('reaches PocketBase still encoded', async () => {
    // PocketBase's own 404 has a `status` and no `error`: the gateway did not answer this one.
    const space = await fetch(`${BASE}/api/collections/employees/records/a%20b`);
    expect(space.status).toBe(404);
    expect(await space.json()).toEqual({ data: {}, message: "The requested resource wasn't found.", status: 404 });

    // Decoded, `%3F` would be a `?`: the path would end at `emp-001` and `x=1` would be a query, and the
    // record would be found. Encoded, the id is `emp-001?x=1` and PocketBase has no such record.
    const question = await fetch(`${BASE}/api/collections/employees/records/emp-001%3Fx=1`);
    expect(question.status).toBe(404);
    expect(await question.json()).toMatchObject({ status: 404 });
  });
});
