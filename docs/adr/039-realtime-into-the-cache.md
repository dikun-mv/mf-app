# ADR 039: Realtime events patch the query cache (D29)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 032](032-pocketbase-data-layer.md) and [ADR 036](036-server-state.md).

## Context

PocketBase realtime sends the action and the whole record for each change ([ADR 032](032-pocketbase-data-layer.md)), and clients refetch after a reconnect because missed events aren't replayed (D6). The apps read the same collections through TanStack Query ([ADR 036](036-server-state.md)), and the other team's data arrives from a second instance.

## Decision

- **One `RealtimeProvider` per PocketBase instance an app reads, in `app/`.**
- On mount it subscribes to each collection the app queries (`subscribe('<collection>/*')`), parses each event's record with the contract schema, and patches that collection's query by id: `create` and `update` replace or add the record, `delete` removes it. An event that fails to parse is logged and dropped, never cached.
- **After a reconnect** (`PB_CONNECT` after the first) it invalidates that instance's queries, because missed events aren't replayed (D6).
- On unmount it unsubscribes and cancels the instance's queries, so an MF unmount leaves no open connection.
- It exposes the connection status (`connecting | live | down`) through context. Widgets that read the other team's data show their degraded state from it (T5.5, T7.4).

## Alternatives

- **Invalidate on every event.** Refetches the whole collection for each edit anywhere.
- **A subscription inside each query hook.** One subscription per component, with a lifetime tied to the component instead of the app.

## Consequences

- Patching is cheap and keeps unchanged references stable ([ADR 044](044-grid-view-model.md)).
- One subscription per collection per app, owned by the app root, ties its lifetime to `mount` and `unmount`.
- Realtime patches and the optimistic updates of ADR 036 meet in one cache. Serial writes and "the server's record wins" keep it consistent.
- The SDK's `PB_CONNECT` event fires on the first connect and after every reconnect, which is what triggers the refetch; T5.4 checks it.
