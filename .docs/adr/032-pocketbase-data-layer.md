# ADR 032: PocketBase per team for the data layer (D4, D5, D6, D8, D25)

Status: accepted (2026-10-07, after Phase 2 and before any Phase 3 work). Supersedes ADRs 004, 005, 006, 008 and 025, and the service rows of ADR 029. Amends ADRs 016, 018, 021 and 023.

## Context

The first plan gave each team a small Hono + lowdb service that re-ran every domain rule on the server. Written out task by task (T3.4–T3.9), each service needed its own validate → decide → apply → persist → emit pipeline, serial write queue, snapshot rollback, SSE broadcaster with heartbeats, error mapping, Rslib build and Docker image, and the tests for all of it. That is a lot of code to own, review and explain for a case study whose weight sits on the domain and on Module Federation. None of the services' code had been written when this was decided.

## Decision

- **One stock PocketBase per team:** `people-pb` (`employees`, `rate_records`) and `delivery-pb` (`projects`, `breakdown_items`, `allocations`, `employee_month_loads`). Each has its own container, `/pb_data` volume (`people-data`, `delivery-data`), migrations and hooks under `services/<name>/`.
- **The schema enforces what it can:** field shapes and bounds, unique indexes, relations and locked API rules (no employee create or delete, D16; no API writes to load rows). **The other rules run in the apps** through the domain packages before a write. Record ids are the entity ids; dates and months are text fields with the contract patterns.
- **Writes are domain change sets sent as one batch request,** which is atomic (D5, D9).
- **Two hooks, both in `delivery-pb`:** `editedAt` is stamped on effort edits (D18), and `employee_month_loads` is rewritten inside each allocation write's transaction (D8). The load logic is a plain CommonJS file, `pb_hooks/lib/load.js`. A fast-check property test holds it equal to `delivery-domain`'s `loadsOf`.
- **Transport is PocketBase realtime** (SSE) through the `pocketbase` JS SDK. Events carry the action and the whole record. Clients refetch after a reconnect (D6).
- **No service build:** one platform-owned image, `infra/docker/pocketbase.Dockerfile`, takes a `SERVICE` build arg (D25).
- **Gateway:** `/api/people/` and `/api/delivery/` go to the two instances with the prefix cut, and the realtime routes run unbuffered. The SDK base URLs are `/api/people` and `/api/delivery` on the page's origin.

The details are in plan §3 (Service design) and tasks T3.1–T3.9.

## Changes to ADR 029

| ADR 029 item                | Now                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Names                    | `@baseline/people-pb` and `@baseline/delivery-pb` (private, test-only packages); compose services `people-pb` and `delivery-pb`    |
| 2. Ports                    | Both instances listen on 8090 inside their containers and publish nothing. The dev servers proxy `/api` to the gateway on 8080     |
| 3. Volumes                  | Same names, mounted at `/pb_data`                                                                                                  |
| 4. URL prefix and `/health` | `/api/people/…` and `/api/delivery/…`, cut by the gateway; PocketBase's own `/api/health`                                          |
| 5. Env and build            | No build. `SEED_FILE` is `/pb/seed/data.json` in the image                                                                         |
| 6. SSE                      | PocketBase realtime at `<base>/api/realtime`                                                                                       |
| 7. `version`                | Dropped. Events carry the record; clients refetch after a reconnect                                                                |
| 8. Error body               | PocketBase's error body. Each adapter maps it to `DomainError` codes in one place                                                  |
| 11. Gateway API routes      | As above                                                                                                                           |
| 13. Reset                   | `docker compose down -v`, or `infra/scripts/reset.sh` that empties both `/pb_data` volumes and restarts, so the migrations re-seed |

Items 9, 10 and 12 (the shell's `config.json`, deep links, SPA fallback) are unchanged.

## Alternatives

- **Keep Hono + lowdb** (the first plan): every rule enforced twice, at the cost of the service code above.
- **One shared PocketBase:** simpler to run, but the two teams would share one deployable and one database, and one failure would take both down.
- **Full server validation in PocketBase:** bundle the domain packages for its JS engine and route every write through custom endpoints. It brings back a build step and most of the service code, and it bets on the engine running the bundles.
- **A SQL view for the load feed:** view collections emit no realtime events, so People couldn't follow capacity live.

## Why

Most of the server work is now configuration: REST, realtime, transactions, serialised writes and crash-safe persistence come from PocketBase and SQLite. Each team still owns its own instance, data and published collections, so the boundary the brief scores (Architecture, 35%) stays as visible as before. Each domain rule still exists once in TypeScript and runs without a browser. The one mirror in JS is pinned by a property test.

## Costs and limits

- **Tree and rate-history rules aren't checked by the server,** so a hand-made API call could break one. The invariant checker (T1.12b) shows any such state in the app. Writes come only from each team's own app.
- **Realtime doesn't replay missed events,** so every subscriber refetches after a reconnect.
- **Hook code is untyped JS,** so it's kept to `pb_hooks/lib/` files with their own tests.
- **The `pocketbase` SDK is one more dependency in each app.** Like `react-router`, it's bundled per app and kept out of MF `shared`.
- **Some PocketBase behaviour is still unverified on the pinned release:** custom id patterns, batch settings from a migration, hooks inside batch transactions, `$os.readFile`, and `require` of CommonJS in hooks. Each has a fallback, listed in the plan's assumptions table, and gets checked in T3.4–T3.6.

_Checked in T3.4 (2026-10-07, [ADR 033](033-pocketbase-runtime-and-checks.md)): every one held on v0.40.4, and no fallback was needed. [ADR 035](035-delivery-pb.md) found that a single (non-batch) allocation write is not atomic with its load refresh, so every app write is a batch._
