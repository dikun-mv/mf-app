# ADR 006: Transport between remotes (D6)

Status: superseded by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07), before Phase 3 was built

## Decision

Server-Sent Events from each service through Hono's `streamSSE` (`/api/people/v1/events`), plus REST reads. Events carry a version and an entity id. Consumers refetch or patch their read model.

## Alternatives

An in-page typed event bus provided by the shell plus `BroadcastChannel`; polling.

## Why

Works hosted, standalone and across tabs. No remote depends on the other remote's JS being loaded.
