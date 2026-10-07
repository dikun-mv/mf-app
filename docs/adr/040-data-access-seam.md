# ADR 040: The repository is a React context (D30)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 032](032-pocketbase-data-layer.md).

## Context

Each app has a repository interface over its PocketBase collections (T5.0a, T6.0a). Components, query hooks and tests all need to reach it, and tests must run without a server or the SDK. Without a rule, the SDK would leak into components and tests would mock modules.

## Decision

- **Each app's repository interface reaches components through a React context set in `app/`.**
- Query and mutation hooks call the repository, never the SDK, and only `shared/api` imports `pocketbase`.
- Tests render with the in-memory fake of the same interface and a fresh `QueryClient` (`retry: false`) per test, through one `renderWithApp` helper in `shared/testing`.

## Alternatives

- **Module-level singletons replaced with `rs.mock`; HTTP mocking (MSW).** Module mocks tie tests to import paths. MSW tests the transport, which the service integration tests already do.

## Consequences

- One seam for production, tests and the walkthrough.
- The fake is typed against the same interface, so it can't drift silently, and no test depends on module mocking or network stubs.
- People and Delivery each write their own context, query client, `RealtimeProvider` and `renderWithApp` to one spec: this ADR with [ADR 036](036-server-state.md) and [ADR 039](039-realtime-into-the-cache.md). The lead compares the two once both have merged.
