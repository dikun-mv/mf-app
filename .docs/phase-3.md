# Phase 3 handover: PocketBase data services

How to build Phase 3 of [plan.md](plan.md) with the [builder](../.claude/agents/builder.md) agent: what to build, in what order, and the three briefs to hand over. The decisions are in [ADR 032](adr/032-pocketbase-data-layer.md) and plan §3 (Service design); this file makes them concrete.

## 1. Keep it small

We moved to PocketBase so the data services stay small. Every brief carries these rules.

- **Configuration, not code.** Each service is migrations, plus hooks only where the plan names one. There are exactly two hooks, both in `delivery-pb`: `editedAt` and the load row. Anything else is a field, an index or an API rule. If a rule can't be expressed that way and the plan doesn't name it, it runs in the app (Phases 4–6), not in PocketBase.
- **No custom routes, no custom endpoints, no wrappers.** Clients use PocketBase's own REST, batch and realtime APIs.
- **No shared code between the two services.** If both need the same few lines, each team writes its own (like the old "copy, don't import" rule).
- **No auth, no superuser setup, no admin dashboard routing, no backups, no logging setup.** None of it is scored.
- **No extra packages.** The only new npm dependencies are `pocketbase` (the SDK) and `eventsource` (a Node polyfill), both for integration tests only.
- **Size budget.** Each `pb_migrations` file stays under about 150 lines, `pb_hooks/lib/load.js` under about 40, and each `*.pb.js` under about 40. Going over means the design has grown: stop and ask the lead.

## 2. Order

Each brief is one `builder` run in its own worktree. The lead merges each branch before launching the next. Nothing runs in parallel.

| Brief                     | Tasks                                         | Needs    |
| ------------------------- | --------------------------------------------- | -------- |
| **S: runtime and checks** | T3.4, T3.8, the PocketBase checks (ADR 033)   | `main`   |
| **P: people-pb**          | T3.1, T3.5, People's half of T3.9 (ADR 034)   | S merged |
| **D: delivery-pb**        | T3.2, T3.6, Delivery's half of T3.9 (ADR 035) | P merged |

The lead then runs the exit check (§6) and ticks the tasks. T3.7 (client adapters) stays in Phases 4–6.

## 3. Fixed values

Every brief uses these. Changing one needs the user.

| Thing            | Value                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PocketBase       | One pinned release: the latest 0.x when S starts (v0.40.x at planning time). Exact version and SHA-256 per architecture as `ARG`s in the Dockerfile                                                                                                                                                                                                                                               |
| Image            | `infra/docker/pocketbase.Dockerfile`, build arg `SERVICE` (`people-pb` or `delivery-pb`). Layout: `/pb/pocketbase`, `/pb/pb_migrations`, `/pb/pb_hooks`, `/pb/seed/data.json`                                                                                                                                                                                                                     |
| Command          | `/pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks --automigrate=false`                                                                                                                                                                                                                                                           |
| Compose services | `people-pb`, `delivery-pb`; volumes `people-data`, `delivery-data` at `/pb_data`; healthcheck `wget -qO /dev/null http://127.0.0.1:8090/api/health`; no published ports                                                                                                                                                                                                                           |
| Gateway          | `/api/people/` → `people-pb:8090`, `/api/delivery/` → `delivery-pb:8090`, prefix cut with `rewrite … break`. `/api/people/api/realtime` and `/api/delivery/api/realtime` add `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 1h`, `proxy_send_timeout 1h`. The `/api/` JSON 404 stays as the catch-all                                                                              |
| SDK base URLs    | `http://localhost:8080/api/people` and `http://localhost:8080/api/delivery` in tests; `/api/people` and `/api/delivery` on the page origin in the apps                                                                                                                                                                                                                                            |
| Record ids       | The entity ids. The `id` field takes pattern `^[a-z0-9]+(-[a-z0-9]+)*$` and max length 64                                                                                                                                                                                                                                                                                                         |
| Seed time        | `2026-01-01T00:00:00.000Z`, the same as `SEEDED_AT` in `delivery-domain`'s test seed                                                                                                                                                                                                                                                                                                              |
| Batch            | Enabled, `maxRequests` 500, timeout 10 s (a project's whole subtree with its allocations fits)                                                                                                                                                                                                                                                                                                    |
| Packages         | `@baseline/people-pb`, `@baseline/delivery-pb`: private, test-only workspace packages                                                                                                                                                                                                                                                                                                             |
| Tests            | Unit: the `services` Rstest project, `services/*/test/**/*.test.ts` minus `test/integration/`. Integration: `pnpm test:integration`, `rstest.integration.config.ts` over `services/*/test/integration/**/*.test.ts`, against the running stack, reset first. Each service's integration tests import their own `test/integration/setup.ts`, which puts the `eventsource` polyfill on `globalThis` |
| ADRs             | 033 (runtime and PocketBase checks), 034 (`people-pb`), 035 (`delivery-pb`)                                                                                                                                                                                                                                                                                                                       |

## 4. Collections

Every collection's `id` field gets the pattern and maximum length from §3 (Record ids) in the migration that creates it. API rules: `""` means public, `null` means locked (superusers only). Dates and months are text fields with the contract patterns, never PocketBase `date` fields. No `created` or `updated` autodate fields: nothing reads them.

### `people-pb`

| Collection     | Fields                                                                                                                                                                                                       | Indexes                          | List, view | Create, update, delete                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------- | --------------------------------------- |
| `employees`    | `name` text required; `role` text required; `weeklyHours` number required, integer, 20–40 (the exact set stays in `people-contract`)                                                                         | none                             | `""`       | `null` (read-only through the API; D16) |
| `rate_records` | `employeeId` relation → `employees`, required, single, no cascade; `validFrom` text required, `^\d{4}-\d{2}-\d{2}$`; `hourlyCost` number required, min just above 0 (`> 0` itself is `people-domain`'s rule) | unique `(employeeId, validFrom)` | `""`       | `""`                                    |

### `delivery-pb`

| Collection             | Fields                                                                                                                                                                                                                                                                                                                                                                                                   | Indexes                                                              | List, view | Create, update, delete        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- | ----------------------------- |
| `projects`             | `name` text required; `startDate`, `endDate` text required, IsoDate pattern                                                                                                                                                                                                                                                                                                                              | none                                                                 | `""`       | `null`                        |
| `breakdown_items`      | `projectId` relation → `projects`, required, single; `parentId` relation → `breakdown_items`, optional, single; `name` text required. No cascade on either relation                                                                                                                                                                                                                                      | `(projectId)`                                                        | `""`       | `""`                          |
| `allocations`          | `breakdownItemId` relation → `breakdown_items`, required, single, no cascade; `employeeId` text required, `^emp-[a-z0-9-]+$` (another instance's id, so not a relation); `month` text required, `^\d{4}-(0[1-9]\|1[0-2])$`; `amount` number, min 0 (not `required`: PocketBase treats 0 as blank on a required number, ADR 035); `editedAt` text, IsoDateTime pattern (set by the hook, so not required) | unique `(breakdownItemId, employeeId, month)`; `(employeeId, month)` | `""`       | `""`                          |
| `employee_month_loads` | `employeeId` text; `month` text; `allocatedPersonMonths` number; `overCapacity` bool; `causingAllocationId` text, empty when not over capacity. Record id `<employeeId>-<month>` (e.g. `emp-001-2026-03`), so the hook can find a row by id                                                                                                                                                              | unique `(employeeId, month)`                                         | `""`       | `null` (only the hook writes) |

### Hooks (`delivery-pb` only)

- **`pb_hooks/allocations.pb.js`, `editedAt` (D18):** on `onRecordCreateRequest` for `allocations`, set `editedAt` to `new Date().toISOString()`. On `onRecordUpdateRequest`, set it to now if `amount` changed, and otherwise back to the stored value, whatever the client sent. Moves (a new `breakdownItemId`) keep it.
- **The same file, load rows (D8):** after `e.next()` in `onRecordCreate`, `onRecordUpdate` and `onRecordDelete` (model hooks, so they run inside the write's transaction through `e.app`), refresh the `(employeeId, month)` row. On an update that changed either field, refresh the old pair too.
- **`pb_hooks/lib/load.js`:** one pure CommonJS function, `loadOf(contributions)`. It takes `{ id, amount, editedAt }[]` for one pair and returns `{ allocatedPersonMonths, overCapacity, causingAllocationId }`, or `null` when no allocation has `amount > 0`. Same rule as `delivery-domain`'s `loadsOf`: sum in id order, `> 1 + 1e-9`, causer the latest `(editedAt, id)` among `amount > 0`. No PocketBase globals. A hand-written `load.d.ts` beside it types it for the tests.
- **`pb_hooks/lib/refresh.js`:** `refreshLoad(app, employeeId, month)`. It reads that pair's allocations through the `app` it's given, calls `loadOf`, then upserts the row by its id, or deletes it when `loadOf` returns `null`. This is the only file that touches the database.

## 5. The briefs

Pass each brief verbatim as the `builder` prompt, with `isolation: "worktree"`.

**Worktree pitfalls (seen in the Phase 2 round).** Two harness behaviours break a naive launch:

1. **A new worktree starts from `origin/main`, not local `main`.** While `main` isn't pushed, `origin/main` is far behind (still "Initial planning"). The `builder` agent's Start section therefore opens every run with a base check that resets a fresh worktree to local `main`. Pushing `main` would remove the problem, but that's the user's call.
2. **The harness deletes a worktree when the agent stops and the worktree's own `worktree-agent-*` branch is unchanged.** A builder that switches to a new branch leaves that branch unchanged, and loses its files. Running agents have also lost tracked files mid-task. So builders **never create or switch branches**: they commit on the worktree's branch, after every working step (also in the agent's Start section).

**The lead, per brief:**

1. **Launch** with `isolation: "worktree"`. In the builder's report, confirm that its base check started from `main`'s tip.
2. **After it stops,** run `git worktree list`. If the worktree is gone or empty, restore it with `git worktree prune && git worktree add <same path> <branch> && git worktree lock <path>`, then resume the builder with `SendMessage`, telling it to run `pnpm install` again.
3. **Name the branch** `p3/<name>` (`git branch -m <worktree branch> p3/<name>`, or `git branch p3/<name> <sha>`).
4. **Review** with the `code-review` skill at `medium`, always with an explicit range: `main...p3/<name> medium`. Given only a branch name it diffs against the stale `origin/main` and reviews the wrong code.
5. **Merge** with `git merge --no-ff p3/<name>` and the message `Merge p3/<name>: …`, then remove the worktree.

### Brief S: runtime and checks

```text
You are building the PocketBase runtime for Phase 3.

Follow your Start section first. The lead names your branch p3/runtime when merging.

Read: .docs/phase-3.md (all of it; §1 is binding), plan §3 "Service design (PocketBase)", T3.4 and
T3.8 in .docs/plan.md, ADR 029, ADR 031 and ADR 032.

You own: infra/docker/pocketbase.Dockerfile, docker-compose.yml, infra/nginx/gateway.conf,
infra/scripts/reset.sh, .docs/adr/031-infra-and-break-methods.md (the /api and reset parts),
.docs/adr/033-*.md, .dependency-cruiser.cjs, .dependency-cruiser.test.ts, rstest.config.ts,
rstest.integration.config.ts, rslint.config.ts, the root package.json scripts, services/.gitkeep, and
the skeletons of services/people-pb/ and services/delivery-pb/ (package.json, tsconfig.json,
pb_migrations/001_settings.js). Nothing else.

Tasks, one commit each:
1. Checks (no commit of the scratch files). In a throwaway container of the pinned release, with
   scratch migrations and hooks under /tmp, find out each of these, with the exact API calls that work:
   a. a migration can change the `id` field's pattern and max (.docs/phase-3.md §3), and records with
      ids `emp-001` and `alloc-<uuid>` save;
   b. a migration can enable the batch API and set maxRequests and the timeout; a batch with one bad
      operation leaves nothing behind;
   c. onRecordCreateRequest and onRecordUpdateRequest fire per batch item; a model hook after e.next()
      writes through e.app inside the batch transaction and is rolled back with it;
   d. whether model hooks fire for records saved by a migration;
   e. a migration can read /pb/seed/data.json ($os.readFile or another JSVM call);
   f. require() of a CommonJS file under pb_hooks/lib works in a hook and in a migration, and how
      the path is written in each (`__hooks` or another way);
   g. a relation field accepts custom ids, and an empty single relation reads back as "";
   h. the error responses (status and JSON body) for: a locked API rule, a field violation, a
      unique-index violation, a duplicate id;
   i. the `pocketbase` SDK in Node, with the `eventsource` polyfill on globalThis, works against a
      base URL with a path (through the gateway) for REST, batch and a realtime subscription.
   Record every answer in .docs/adr/033-pocketbase-runtime-and-checks.md: what was checked, the result,
   the snippet that works, and the fallback used where plan.md's assumptions table names one.
   If an answer breaks a decision with no fallback, stop and report.
2. The image, compose services, volumes and gateway routes from .docs/phase-3.md §3. Update ADR 031
   for the new /api routes.
3. The two service skeletons: package.json (private, test-only, with no `typecheck` script yet: P
   and D add it with their first test, since tsc fails on a package with no inputs), tsconfig.json
   (include `test`), and pb_migrations/001_settings.js (batch settings only; ids are widened per
   collection by P and D). Remove services/.gitkeep. Update
   .dependency-cruiser.cjs and its test: services/people-pb and services/delivery-pb in the ownership
   groups, and app-to-own-service-types-only replaced by apps-no-services (apps never import
   services/). Update the `services` Rstest project, and add rstest.integration.config.ts plus the
   `test:integration` script. Make `pnpm lint` cover the PocketBase JS by declaring the PocketBase
   globals your files use (don't turn off other rules).
4. infra/scripts/reset.sh as T3.8 describes (stop both, empty /pb_data, start again from an EXIT trap).
   Document both reset methods in ADR 031.

You may run `docker compose up` (gateway on 8080). Done when: `docker compose up -d --build --wait`
is healthy, `curl localhost:8080/api/people/api/health` and the delivery one return 200, `curl -N`
on both realtime URLs shows PB_CONNECT at once (no buffering), reset.sh works twice in a row, and
`pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

### Brief P: people-pb

```text
You are building People's data service for Phase 3.

Follow your Start section first. The lead names your branch p3/people-pb when merging.

Read: .docs/phase-3.md (all of it; §1 is binding), ADR 033 (what the PocketBase checks found; use the
snippets that work), plan §3 "Service design (PocketBase)", T3.1, T3.5 and T3.9 in .docs/plan.md,
and D7, D16 and D21.

You own: packages/people-contract/, services/people-pb/ (except pb_migrations/001_settings.js),
.docs/adr/034-*.md. Nothing else.

Tasks, one commit each:
1. people-contract v1 (T3.1): PEOPLE_BASE_PATH ('/api/people'), the collection names (each is
   also its realtime topic, `<name>/*`), the effective-dating rule in prose (a doc comment), and
   record schemas EmployeeRecord and RateRecordRecord. Each parses a PocketBase record into the existing
   Employee or RateRecord and drops PocketBase's own fields. Add the conformance fixture: A. Okafor's
   rate records and the expected March 2026 slices (8 days at 80, 14 at 95). Tests next to the code.
   Update the header comment, which still promises REST paths and events.
2. Collections (T3.5): pb_migrations/002_collections.js, exactly as .docs/phase-3.md §4.
3. Seed: pb_migrations/003_seed.js inserts the 60 employees and 150 rate records from
   /pb/seed/data.json, keeping their ids.
4. Integration tests in services/people-pb/test/integration/, through the gateway with the SDK:
   seed counts; every employees write is refused; a rate create, correction and delete work; a second
   rate on the same (employeeId, validFrom) fails with the unique-index error from ADR 033; a rate
   edit reaches a realtime subscriber on rate_records; every record parses with the contract
   schemas.
5. .docs/adr/034-people-pb.md: what was built, and anything that differed from .docs/phase-3.md.

No hooks in people-pb. You may run `docker compose up` (gateway on 8080) and infra/scripts/reset.sh. Done when
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:integration` (after a reset) are green.
```

### Brief D: delivery-pb

```text
You are building Delivery's data service for Phase 3.

Follow your Start section first. The lead names your branch p3/delivery-pb when merging.

Read: .docs/phase-3.md (all of it; §1 is binding), ADR 033, plan §1 (facts from the fixtures), plan §3
"Service design (PocketBase)", T3.2, T3.6 and T3.9 in .docs/plan.md, D8, D9, D18 and D21, and
packages/delivery-domain/src/capacity.ts.

You own: packages/delivery-contract/, services/delivery-pb/ (except pb_migrations/001_settings.js),
the header comment of packages/delivery-domain/src/capacity.ts, .docs/adr/035-*.md. Nothing else.

Tasks, one commit each:
1. delivery-contract v1 (T3.2): DELIVERY_BASE_PATH ('/api/delivery'), the employee_month_loads
   collection name, and EmployeeMonthLoadRecord, which parses a load row into the existing
   EmployeeMonthLoad ("" causer → null) and drops PocketBase's fields. Only this collection is
   published. Delivery's own collections get parsed in its app adapter later (T3.7), not here.
   Update the header comment.
2. pb_hooks/lib/load.js, load.d.ts and a fast-check property test in services/delivery-pb/test/ that
   loadOf gives the same numbers, flag and causer as delivery-domain's loadsOf, over random
   allocations for one (employee, month) with small id and editedAt pools, so ties happen. Write the
   arbitraries in the test; don't import delivery-domain's testing/ folder.
3. Collections: pb_migrations/002_collections.js, exactly as .docs/phase-3.md §4.
4. Hooks: pb_hooks/lib/refresh.js and pb_hooks/allocations.pb.js, exactly as .docs/phase-3.md §4.
5. Seed: pb_migrations/003_seed.js inserts the 4 projects, the 90 breakdown items (parents before
   children) and the 720 allocations with editedAt = 2026-01-01T00:00:00.000Z, then the load rows.
   Use what ADR 033 found about hooks in migrations, so each row is written once.
   Update capacity.ts's header comment, which still names delivery-api's /load.
6. Integration tests in services/delivery-pb/test/integration/, through the gateway with the SDK:
   - seed counts, and exactly 6 over-capacity rows with the causers in plan §1;
   - an amount edit stamps a new editedAt, and the edited allocation becomes the causer;
   - a move (new breakdownItemId) keeps editedAt and the load;
   - a D9 batch (create a child item under a leaf and re-point the leaf's allocations to it)
     commits as one, and keeps editedAt and the load;
   - a batch with one bad operation leaves nothing behind (no allocation, no load change);
   - a duplicate (breakdownItemId, employeeId, month) fails with the unique-index error;
   - a write to employee_month_loads is refused;
   - an allocation edit reaches a realtime subscriber on employee_month_loads;
   - every load row parses with EmployeeMonthLoadRecord.
7. .docs/adr/035-delivery-pb.md: what was built, and anything that differed from .docs/phase-3.md.

No other hooks and no custom routes. You may run `docker compose up` (gateway on 8080) and
infra/scripts/reset.sh.
Done when `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:integration` (after a reset)
are green.
```

## 6. Exit check (lead, after D is merged)

1. `docker compose down -v && docker compose up -d --build --wait`. Everything is healthy, and the shell and both remotes still load (the Phase 2 checks).
2. `pnpm lint && pnpm typecheck && pnpm test`, then `infra/scripts/reset.sh && pnpm test:integration`.
3. The plan's Phase 3 exit check by hand, through `localhost:8080`:
   1. Subscribe to `rate_records` and edit a rate: the event arrives.
   2. Edit an allocation: its `employee_month_loads` row changes.
   3. Run `docker compose restart people-pb delivery-pb`: both edits are still there.
4. Measure the size against §1: `wc -l services/*/pb_migrations/*.js services/*/pb_hooks/**/*.js`.
5. Tick T3.1, T3.2, T3.4–T3.6, T3.8 and T3.9 in plan.md (T3.7 stays open). Commit: `Tick T3.1-T3.6, T3.8 and T3.9 after the Phase 3 exit check`.
