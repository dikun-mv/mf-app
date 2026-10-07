import { DELIVERY_BASE_PATH } from '@baseline/delivery-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import { createClient, GATEWAY, Scratch, SEED_PROJECT } from './setup';

// What the gateway forwards to Delivery's PocketBase under /api/delivery/ (ADR 031): an allowlist. The SDK's
// own paths (health, batch, the records routes and realtime) work; PocketBase's superuser and admin API,
// the schema and auth routes, `_` system collections and the dashboard answer the gateway's JSON 404.
// Tests go through `GATEWAY` with the SDK where the SDK has a call, and with plain `fetch` otherwise.
const pb = createClient();
const items = pb.collection('breakdown_items');
const BASE = `${GATEWAY}${DELIVERY_BASE_PATH}`;

/** The gateway's own 404 body, which PocketBase never produces. */
const GATEWAY_NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'No such API route' } };

const scratch = new Scratch(pb);
afterEach(async () => scratch.clean());

describe('the allowed routes', () => {
  it('answers the health check', async () => {
    expect(await pb.health.check()).toMatchObject({ code: 200 });
  });

  it('lists records, with a filter and a sort in the query string', async () => {
    const page = await pb.collection('projects').getList(1, 5, {
      filter: pb.filter('id = {:a} || name != {:b}', { a: SEED_PROJECT, b: 'no such project' }),
      sort: '-id',
    });
    expect(page.items.map((r) => r.id)).toContain(SEED_PROJECT);
    expect(page.totalItems).toBe(page.items.length);
  });

  it('passes the query string through untouched', async () => {
    // `%27` and `%25` are a quote and a percent sign. A gateway that decoded the query twice would break them.
    const response = await fetch(`${BASE}/api/collections/projects/records?filter=id%3D%27prj-1%27&perPage=1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalItems: 1, perPage: 1 });
    const percent = await fetch(`${BASE}/api/collections/projects/records?filter=name~%27100%25%27`);
    expect(percent.status).toBe(200);
    expect(await percent.json()).toMatchObject({ totalItems: 0 });
  });

  it('reads one record, and lists a collection whose rows the hooks write', async () => {
    expect(await pb.collection('projects').getOne(SEED_PROJECT)).toMatchObject({ id: SEED_PROJECT });
    expect((await pb.collection('employee_month_loads').getList(1, 1)).totalItems).toBeGreaterThan(0);
  });

  it('creates, updates and deletes a record', async () => {
    const id = await scratch.item();
    await items.update(id, { name: 'renamed' });
    expect(await items.getOne(id)).toMatchObject({ name: 'renamed' });
    await items.delete(id);
    await expect(items.getOne(id)).rejects.toMatchObject({ status: 404 });
  });

  it('sends a batch', async () => {
    const [first, second] = [`wbs-${crypto.randomUUID()}`, `wbs-${crypto.randomUUID()}`];
    scratch.items.push(first, second);
    const batch = pb.createBatch();
    batch.collection('breakdown_items').create({ id: first, projectId: SEED_PROJECT, parentId: '', name: 'one' });
    batch.collection('breakdown_items').create({ id: second, projectId: SEED_PROJECT, parentId: '', name: 'two' });
    expect((await batch.send()).map((r) => r.status)).toEqual([200, 200]);
    expect(await items.getOne(second)).toMatchObject({ name: 'two' });
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
    ['GET', '/api/collections/allocations'],
    ['DELETE', '/api/collections/allocations'],
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
    ['GET', '/api/collections/employees/records'],
    // Auth routes of any collection.
    ['POST', '/api/collections/allocations/auth-with-password'],
    ['POST', '/api/collections/allocations/auth-refresh'],
    ['GET', '/api/collections/allocations/auth-methods'],
    // Not a records route: a trailing slash, a longer path, an upper-case name, a slash inside an id.
    ['GET', '/api/collections/projects/records/'],
    ['GET', '/api/collections/projects/records/prj-1/extra'],
    ['GET', '/api/collections/Projects/records'],
    ['GET', '/api/collections/projects/records/a%2Fb'],
    // Files, and the dashboard.
    ['GET', '/api/files/projects/prj-1/photo.png'],
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
    const space = await fetch(`${BASE}/api/collections/projects/records/a%20b`);
    expect(space.status).toBe(404);
    expect(await space.json()).toEqual({ data: {}, message: "The requested resource wasn't found.", status: 404 });

    // Decoded, `%3F` would be a `?`: the path would end at `prj-1` and `x=1` would be a query, and the
    // record would be found. Encoded, the id is `prj-1?x=1` and PocketBase has no such record.
    const question = await fetch(`${BASE}/api/collections/projects/records/${SEED_PROJECT}%3Fx=1`);
    expect(question.status).toBe(404);
    expect(await question.json()).toMatchObject({ status: 404 });
  });
});
