# ADR 033: PocketBase runtime and what the checks found (T3.4)

Status: accepted

## Context

[ADR 032](032-pocketbase-data-layer.md) moved both data services to PocketBase and left several behaviours unverified on the pinned release (its "Costs and limits"). Plan §2 lists each with a fallback. This ADR fixes the runtime and records what each check found, with the calls that work, so the people-pb and delivery-pb builders use them as written.

## Decision

**Release.** PocketBase **v0.40.4** (the latest 0.x when T3.4 started). The Dockerfile has the version and both Linux checksums (`amd64`, `arm64`, from the release's `checksums.txt`) as `ARG`s, and fails the build when the download doesn't match. Changing the pin means changing the three `ARG`s together.

**Image.** `infra/docker/pocketbase.Dockerfile`, build arg `SERVICE` (`people-pb` or `delivery-pb`), build context the repo root. A `fetch` stage downloads and checks the zip for `TARGETARCH`; the final stage is plain `alpine` with `/pb/pocketbase`, the service's `pb_migrations/` and `pb_hooks/` (an empty folder when the service has none), `/pb/seed/data.json` (from `docs/data.json`) and `/pb_data`. The command is the one in [phase-3.md](../phase-3.md) §3. The healthcheck is in compose, where the other services have theirs.

**Compose and gateway.** `people-pb` and `delivery-pb` with the volumes `people-data` and `delivery-data` at `/pb_data`, no published ports. The gateway routes are in [ADR 031](031-infra-and-break-methods.md).

**`001_settings.js`** (one per service, the same file): `settings.batch.enabled = true`, `maxRequests = 500`, `timeout = 10`, then `app.save(settings)`. Each collection widens its own `id` field in the migration that creates it.

## What was checked

Everything ran on v0.40.4 in a throwaway container with scratch migrations and hooks outside the repo. (i) ran through the real gateway. No answer broke a decision, and no fallback was needed. Two results differ from what the plan wrote down, under (h) and (g).

### a. Custom record ids

A migration can widen the `id` field. `new Collection({...})` has **no `id` field until it is saved** (`fields.getByName('id')` is `null`), so widen after the first save. The default field has `min: 15, max: 15`, so `min` must be lowered too, or `emp-001` (7 characters) is refused.

```js
const widenId = (app, name) => {
  const c = app.findCollectionByNameOrId(name);
  const id = c.fields.getByName('id');
  id.pattern = '^[a-z0-9]+(-[a-z0-9]+)*$';
  id.min = 1;
  id.max = 64;
  app.save(c);
};
```

Also works: putting a full `{ type: 'text', name: 'id', primaryKey: true, system: true, required: true, pattern, min: 1, max: 64, autogeneratePattern: '[a-z0-9]{15}' }` first in the `fields` array of the new collection. Keep `autogeneratePattern`, so a create without an `id` still gets one.

Results through the API (POST with `id`): `emp-001` and `alloc-<uuid>` (42 characters) save and read back; 64 characters saves; `Alloc-1` and `a--b` give 400 `validation_invalid_format` on `id`. The record can also be saved from a migration with `r.id = 'emp-001'`.

The error of a **hook's own save** surfaces as a field error of the request: a 61-character item id made the hook's `'ld-' + id` row 64 characters and 62 made it 65, and the request failed with `validation_max_text_constraint` on `id`. For `employee_month_loads` (`<employeeId>-<month>`) this doesn't matter, but ids that a hook derives must fit the derived collection's limit too.

### b. Batch settings, and a bad operation

The migration in `001_settings.js` works: `GET /api/settings` (as a superuser) reads back `"batch":{"enabled":true,"maxRequests":500,"timeout":10,"maxBodySize":0}`. `timeout` is in seconds. A batch of 500 creates returns 200 with 500 results; 501 returns 400 `{"data":{"requests":{"code":"validation_length_too_long","params":{"max":500,...}}},"message":"Invalid batch request data."}`.

A batch with one bad operation leaves nothing behind. Two creates where the second has an invalid month: 400, and the first record does not exist afterwards (404 on `GET`). The same holds for a unique-index violation on the second operation. The body names the failing operation by index:

```json
{
  "status": 400,
  "message": "Batch transaction failed.",
  "data": {
    "requests": {
      "1": {
        "code": "batch_request_failed",
        "message": "Batch request failed.",
        "response": {
          "status": 400,
          "message": "Failed to create record.",
          "data": { "month": { "code": "validation_invalid_format", "message": "Invalid value format." } }
        }
      }
    }
  }
}
```

Update and delete operations work in a batch too (`PATCH`, `DELETE`); a delete returns `{"body":null,"status":204}` as its item.

### c. Hooks inside a batch

Confirmed on the pinned release, all with scratch hooks on an `items` collection:

- `onRecordCreateRequest` and `onRecordUpdateRequest` fire **once per batch item**: every created record carries the note the hook set, and a batch update of `b-1` got the update note. A change made with `e.record.set(...)` before `e.next()` is saved.
- Model hooks (`onRecordCreate`, `onRecordUpdate`, `onRecordDelete`) that call `e.next()` first and then write through **`e.app`** run inside the batch's transaction. A hook that upserts a row in another collection works for create (`e.app.save(new Record(...))`), update (`e.app.findRecordById(...)` then `e.app.save`) and delete (`e.app.delete`).
- They roll back with it. A batch of (create `b-3`, create with a bad month) leaves neither `b-3` nor its hook row. A batch of (update `u-1`'s amount, bad create) leaves `u-1` and its hook row at their old values.
- Realtime events of a rolled-back batch are **not** sent (a subscriber saw nothing for a failed batch). After a committed batch it gets one event per item, in order (`create`, `update`, `delete`).
- A hook sees the load row's own validation: a failing `e.app.save` inside the hook fails the request, with the error against the hook's record (see (a)).

```js
onRecordCreate((e) => {
  e.next();
  const { loadOf } = require(`${__hooks}/lib/load.js`); // inside the handler, see (f)
  const row = new Record(e.app.findCollectionByNameOrId('loads'));
  row.id = 'ld-' + e.record.id;
  // … set fields
  e.app.save(row);
}, 'items');
```

### d. Model hooks for records saved by a migration

**They fire.** Hooks in `pb_hooks` are registered before the migrations run, so an `app.save(record)` in a migration runs `onRecordCreate` (the model hook) and its `e.app` writes; the request hooks (`…Request`) don't, since there is no request. A seed that saves allocations with plain `app.save` therefore gets its `employee_month_loads` rows from the hook, each pair's row rewritten per allocation.

To skip them, save through `app.unsafeWithoutHooks().save(record)`: the model hook did not fire (no hook row). delivery-pb can choose between the two: let the hook write the load rows (simplest, 720 small refreshes), or seed with `unsafeWithoutHooks()` and write each row once from `loadOf`.

### e. Reading the seed file

`$os.readFile` works in a migration and returns bytes:

```js
const data = JSON.parse(toString($os.readFile('/pb/seed/data.json')));
```

`data.json` has `employees`, `rateRecords`, `projects`, `breakdownItems` (`parentId: null` for roots), `allocations` and `meta`. No fallback (a generated CommonJS seed module) is needed.

### f. `require` of a CommonJS file under `pb_hooks/lib`

Works in a hook handler and in a migration. Both of these spellings work in a migration; in a handler the first one was used:

```js
require(`${__hooks}/lib/load.js`); // __hooks is '/pb/pb_hooks' (the --hooksDir value), set in hooks and migrations
require('/pb/pb_hooks/lib/load.js'); // absolute path, same result
```

`module.exports = { loadOf }` in the file, `const { loadOf } = require(...)` at the call site. Hook handlers run in isolated scopes, so **the `require` must be inside the handler**: a `const lib = require(...)` at the top of the `*.pb.js` is `undefined` in the handler (`ReferenceError: topLib is not defined`). Rstest imports the same file in Node (it is plain CommonJS with no PocketBase globals; the Node side is checked by the property test in Phase 3, brief D).

### g. Relations with custom ids, and empty relations

A single relation (`maxSelect: 1`) accepts custom ids on create and update, and a filter on it works (`parent = "seed-item-1"`). An unknown id is 400 `validation_missing_rel_records` on that field. An empty single relation **reads back as `""`**, whether omitted, sent as `""` or sent as `null`. A self-relation needs the collection to be saved first: create it, then `c.fields.add(new RelationField({ name: 'parent', collectionId: c.id, maxSelect: 1 }))` and save again.

Deleting a referenced record depends on whether the relation is required, with `cascadeDelete: false`:

| Referencing field                         | Deleting the referenced record                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| required (`projectId`, `breakdownItemId`) | 400 `Failed to delete record. Make sure that the record is not part of a required relation reference.` Delete the referencing records first, in the same batch. |
| optional (`parentId`)                     | 204, and the referencing field is **silently set to `""`**: a parent deleted before its children leaves orphan roots                                            |

So the "children first" order is enforced by the server for required relations only. For `breakdown_items.parentId` it stays the app's rule (T1.12b flags such orphans).

### h. Error responses

All are JSON `{ "status", "message", "data" }`, on the REST API as well as inside a batch (there under `data.requests.<index>.response`).

| Case                                                     | Status  | Body                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A locked rule, any of list, view, create, update, delete | **403** | `{"status":403,"message":"Only superusers can perform this action.","data":{}}`                                                                                                                                                                                                                              |
| A field violation                                        | **400** | `message: "Failed to create record."`, `data.<field> = { code, message, params? }`, one entry per failing field. Codes seen: `validation_min_number_constraint`, `validation_invalid_format`, `validation_required` ("Cannot be blank."), `validation_max_text_constraint`, `validation_missing_rel_records` |
| A unique-index violation                                 | **400** | `data` has **one entry per column of the index**, each `{"code":"validation_not_unique","message":"Value must be unique."}`: for `(emp, month)` both `emp` and `month`                                                                                                                                       |
| A duplicate record id                                    | **400** | `data.id = {"code":"validation_pk_invalid","message":"The record primary key is invalid or already exists."}`                                                                                                                                                                                                |
| A record or collection that doesn't exist                | **404** | `"The requested resource wasn't found."` / `"Missing collection context."`                                                                                                                                                                                                                                   |

**Differs from the plan.** Plan §3 (request flow, step 4) maps `validation_not_unique` _including a duplicate client-generated id_ to `conflict`. A duplicate id gives **`validation_pk_invalid`** on `id`, not `validation_not_unique`. The adapters (T3.7) map both codes to `conflict`: `validation_not_unique` on any field, and `validation_pk_invalid` on `id`. A malformed id is `validation_invalid_format` on `id`, a different code.

### i. The SDK in Node, through the gateway

`pocketbase` 0.28.1 and `eventsource` 5.1.2 from npm (the integration tests pin whatever `pnpm add` resolves), Node 22 (the full run) and Node 24 (health and a realtime connection, on the delivery route), base URL `http://localhost:8080/api/people`. Everything below worked through the gateway with the prefix cut:

```js
import PocketBase from 'pocketbase';
import { EventSource } from 'eventsource';
globalThis.EventSource = EventSource;              // before the first subscribe

const pb = new PocketBase('http://localhost:8080/api/people');
pb.autoCancellation(false);                        // parallel calls in tests
await pb.collection('items').create({ id: 'x-1', emp: 'emp-002', month: '2050-01', amount: 2 });

const batch = pb.createBatch();
batch.collection('items').create({ … });
batch.collection('items').update('x-1', { amount: 3 });
await batch.send();                                // rejects with ClientResponseError on a bad item

const unsubscribe = await pb.collection('items').subscribe('*', (e) => { e.action; e.record; });
```

- **REST:** `getList` with `filter` and `sort`, `getOne`, `create` with a custom `id`, `health.check()`.
- **Errors:** `ClientResponseError` has `status` and `response` (the body in (h)); a bad batch rejects with status 400 and the per-operation detail in `response.data.requests`.
- **Batch:** `createBatch().send()` returns one `{ status, body }` per operation. A bad item rejects the whole call and nothing is kept.
- **Realtime:** events arrived through nginx with buffering off: `curl -N` shows `PB_CONNECT` 4 ms after the request. `subscribe('*')` delivered `create`, `update` and `delete` events, also for records changed in a batch. **A restart of the container is survived**: `pb.realtime.onDisconnect` fired about 3 s after `docker compose restart people-pb`, and the SDK reconnected and resubscribed on its own; an event for a record created after the restart arrived. Events missed while disconnected are not replayed, so adapters refetch after a reconnect (D6).
- **The polyfill is needed in Node.** Without it the first `subscribe` throws `ReferenceError: EventSource is not defined`. Node has no global `EventSource`.
- In a browser the base URL can be the page-relative `/api/people`; that is not exercised here, since Node needs an absolute URL. The paths the SDK adds (`/api/…`) are the reason the gateway route is `/api/people/api/…`.

## Alternatives

- **Keep PocketBase ids and a unique `key` field** (plan §2 fallback for ids): not needed, since (a) works. It would have put a second id in every record and every relation.
- **A generated seed module** (fallback for `$os.readFile`): not needed, (e) works.
- **One image per service:** two Dockerfiles that differ by a `COPY` line. The build arg keeps one place for the pin and the checksums.
- **The SDK's `pb.collection().subscribe` in Node through a fetch-based client** instead of the `eventsource` polyfill: more code for no gain, and the brief fixes `eventsource` as the only extra dependency.

## Why

The checks answered every open assumption on the pinned release without a fallback, and surfaced four things the builders need: ids widen only after the collection's first save and need a lowered `min`; `require` belongs inside the handler; model hooks also fire for migration saves (and can be skipped); and a duplicate id is `validation_pk_invalid`.

## Costs and limits

- **The pin is one binary for both teams.** A PocketBase upgrade is a platform change: both services, both checksums, and the checks above repeated.
- **Behaviour that is PocketBase's, not ours:** optional relations are cleared on delete (g), batch errors nest the operation's body under `data.requests.<index>.response`, and a hook's failing save shows up as an error on the request's own record.
- **The dashboard** (`/_/`) is not routed by its own path, but the gateway's `/api/people/` prefix also forwards `/api/people/_/` to it. There is no superuser and no login (plan §1).
