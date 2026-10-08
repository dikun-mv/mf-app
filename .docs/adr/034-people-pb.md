# ADR 034: `people-pb`, People's data service (T3.1, T3.5, T3.9)

Status: accepted

## Context

[ADR 032](032-pocketbase-data-layer.md) gave People a stock PocketBase, and [ADR 033](033-pocketbase-runtime-and-checks.md) fixed the runtime and what the checks found. [phase-3.md](../phase-3.md) §4 lists People's collections. This ADR records what was built from it, and where the result differs.

## Decision

**Three migrations and no hooks.** `services/people-pb/pb_migrations/` holds `001_settings.js` (the runtime's batch settings), `002_collections.js` (77 lines) and `003_seed.js` (27 lines). There is no `pb_hooks/`: every People rule is a field, an index, an API rule, or a `people-domain` check in the app.

**Collections** (`002_collections.js`, as phase-3.md §4):

| Collection     | Fields                                                                                                                                                               | Index                            | List, view | Create, update, delete |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------- | ---------------------- |
| `employees`    | `name`, `role` (text, required); `weeklyHours` (number, required, integer, 20 to 40)                                                                                 | none                             | public     | locked                 |
| `rate_records` | `employeeId` (relation to `employees`, required, single, no cascade); `validFrom` (text, required, `^\d{4}-\d{2}-\d{2}$`); `hourlyCost` (number, required, min 0.01) | unique `(employeeId, validFrom)` | public     | public                 |

Each collection widens its `id` field after its first save, with the snippet from ADR 033 (a): pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, `min` 1, `max` 64. There are no `created` or `updated` fields.

**Seed** (`003_seed.js`): reads `/pb/seed/data.json` with `$os.readFile`, and saves the 60 employees and then the 150 rate records with plain `app.save`, keeping the ids. The entries already use the collections' field names, so each is set field by field with no mapping. A restart keeps edits (PocketBase records which migrations ran); a reset re-runs all three.

**`people-contract` v1** (`packages/people-contract`):

- `PEOPLE_BASE_PATH` (`/api/people`) and `PEOPLE_COLLECTIONS` (`employees`, `rate_records`). A collection name is also its realtime topic: `subscribe('*')` listens to `<name>/*`.
- `EmployeeRecord` and `RateRecordRecord` parse a PocketBase record into `Employee` and `RateRecord`. They need `collectionName` to be the right collection (so a record of the other one is refused) and return only the entity's own fields, which drops `collectionId` and `collectionName`. There are no write schemas: writes send the entity's own fields.
- The effective-dating rule is prose in the doc comment of `RateRecordRecord`, and the conformance fixture is `OKAFOR_RATE_RECORDS` plus `OKAFOR_MARCH_2026_SLICES` (`src/conformance.ts`, exported from the package root): 8 working days at 80 and 14 at 95.

**Integration tests** (`services/people-pb/test/integration/`, run by `pnpm test:integration` through the gateway with the SDK): `setup.ts` (the `eventsource` polyfill, a client, and helpers that read PocketBase's error body with zod), and three files:

- `seed.test.ts`: 60 and 150 records, ids kept, every record parses with the contract schemas, and A. Okafor's live records equal the fixture.
- `employees.test.ts`: create (with and without an id), update, delete and a batch containing an update are all refused with 403 (400 for the batch, naming the operation), and nothing changes.
- `rate-records.test.ts`: create with a client-generated id, correction of cost and start day, delete, and a delete plus create as one batch; the unique-index failure, a duplicate id, field errors; and realtime: an edit and a delete reach a subscriber on `rate_records`, a committed batch sends one event per record, and a rolled-back one sends none. Each test removes what it adds, so the counts hold and the suite can run twice without a reset.

## What differed from phase-3.md

- **`hourlyCost` minimum is 0.01.** phase-3.md says "min just above 0". A cent is the smallest step of a price, so it is the smallest value anyone means. `> 0` stays `people-domain`'s rule.
- **A required number field treats 0 as blank.** `hourlyCost: 0` is refused with `validation_required`, not `validation_min_number_constraint`; a negative value or 0.005 gets the min error. The adapter (T3.7) maps both to `validation`, so this only matters for a test that pins the code.
- **A unique-index failure on a rate reports both columns** (`employeeId` and `validFrom`), as ADR 033 (h) found. It holds for a create and for a correction that moves a rate onto a taken day.
- **The service's `package.json` grew** from the skeleton: a `typecheck` script (added with the first test, as the runtime brief said), `@baseline/people-contract` and `zod` (the contract's peer dependency). No new npm package.
- **The fixture is plain data, not branded types.** `people-contract` cannot import the date logic, and the branded types are built by its own schemas, so the fixture is `as const` data and a reader parses it (`RateRecord.array().parse(OKAFOR_RATE_RECORDS)`). The contract's own test checks its weekday counts with a small independent count.
- **The fixture is exported from the package root,** since the package has a single export. Delivery's test in `delivery-domain` can import it from `@baseline/people-contract`.

## Alternatives

- **Cascade delete on `employeeId`:** employees can't be deleted (D16), and a rate must not vanish silently if that ever changes.
- **Reject rates with a check in a hook:** the plan allows exactly two hooks, both in `delivery-pb`. The rate-history rules (T1.13) run in the app.
- **`zod`'s `.pipe` from a loose object to the entity** for the record schemas: it does not type-check with `exactOptionalPropertyTypes`, so the schemas extend the entity with `collectionName` and drop it in a transform.

## Why

Three short migrations are the whole service, so People's team owns a schema and a seed, not a server. The contract carries the only thing both teams must agree on beyond types: the effective-dating rule, pinned to numbers.

## Costs and limits

- **Nothing checks the rate-history rules on the server.** A hand-made API call can set a rate the domain would refuse, such as a cost of 0.01 or an unrealistic date; only `people-domain`'s `checkRateHistory` (run by the app) knows the rule.
- **`rate_records` writes are public.** There is no auth (plan §1), so anyone who can reach the gateway can change a rate.
- **The record schemas require `collectionName`.** A client that reads a record with a field filter (`fields=id,name`) drops it, and the schema then refuses the record. The adapters read whole records.
- **The server patterns are looser than the contract schemas.** `validFrom` only has to look like `YYYY-MM-DD`, so `2026-02-30` is stored but `IsoDate` refuses it, and an id only has to match the widened pattern, so a create without an `id` gets PocketBase's 15-character id, which `RateRecordId` (`rate-<number|uuid>`) refuses. The apps send dates and ids their domain package generates, so a record that fails a contract schema can only come from a hand-made API call. T3.7's adapter parses per record, so it should skip or flag that record and not fail the whole read.
