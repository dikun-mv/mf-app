# ADR 036: Server state with TanStack Query (D26)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4)

## Context

People and Delivery show records that live in PocketBase ([ADR 032](032-pocketbase-data-layer.md)). The apps need caching, loading and error states, and optimistic writes with rollback, and realtime events ([ADR 039](039-realtime-into-the-cache.md)) must reach what the screens show. The shell doesn't need any of it: it reads `config.json` once at boot.

## Decision

- **TanStack Query v5 (`@tanstack/react-query`) in People and Delivery.** One `QueryClient` per mounted app, created in `App` with `useState(() => new QueryClient(…))`, so the `./App` and `./mount` paths each get one, and cleared when it unmounts.
- **Realtime keeps the cache fresh:** `staleTime: Infinity`, `refetchOnWindowFocus: false`.
- **One query per collection**, each the whole collection (`getFullList`; the largest is 720 allocations), keyed by a typed key factory per collection in `shared/api` ([ADR 038](038-feature-sliced-design.md)). The cache holds parsed contract records, never derived values: `PlanState` and the grid come from the domain functions ([ADR 045](045-grid-view-model.md)).
- **Writes go through one hook per app, `useApplyChangeSet`.** `onMutate` applies the change set to the cached collections with `applyChangeSet` and keeps the touched records. `onSuccess` parses the batch response and writes its records into the cache, so the cache is right even while realtime is down (the echo of the same records changes nothing). `onError` puts the touched records back and invalidates their collections.
- Every mutation has `scope: { id: '<app>-writes' }`, so an app's writes reach the server one at a time, in order.
- Not in MF `shared` and not in the pnpm catalog: each app bundles and upgrades its own copy, like `react-router` (D22).

## Alternatives

- **SWR; RTK Query; a hand-written read model over the repository.** Each would leave us to write the optimistic update and rollback ourselves, or add a store (RTK) that [ADR 041](041-client-state.md) rules out.

## Consequences

- Caching, deduplication, loading and error states, and optimistic updates with rollback are written once and widely known. The plan's change sets map straight onto `onMutate`, and `applyChangeSet` stays the one place a change set is applied.
- Patching by id and structural sharing keep unchanged records' references stable, which the grid's memoisation relies on ([ADR 045](045-grid-view-model.md)).
- One more library per remote, bundled twice. `@tanstack/eslint-plugin-query` isn't among Rslint's built-in plugins (D24), so the key factories stand in for its query-key rules.
