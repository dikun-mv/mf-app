# ADR 042: Loading with Suspense, and optional data from the other team (D32)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 036](036-server-state.md).

## Context

A page needs its own data before it can render, but the apps also read the other team's service (People reads load rows, Delivery reads employees and rates). One service down must not blank the other team's screens (T7.4). The shell already has a `Suspense` around its remote panel (T2.5).

## Decision

- **An app's own data loads with `useSuspenseQuery`, under a `Suspense` and an error boundary per page, inside the remote.** The page shows its own loading state, and a failed load shows an inline message with retry (`QueryErrorResetBoundary` with `ui`'s `ErrorBoundary`).
- **The shell's panel `Suspense` (T2.5) only ever covers loading the remote's code.**
- **The other team's data never suspends or throws:** it uses `useQuery`, and the widget renders a degraded state while it is pending or failed.
- People shows "capacity unknown" (T5.5). Delivery without `people-pb` still shows PM and %, shows employee ids instead of names, and marks hours and cost unavailable (T6.13).

## Alternatives

- **`isPending` branches in every component; one boundary for the whole remote.** The first repeats the same check everywhere. The second lets one error replace a page that has already loaded.

## Consequences

- Components that read data can assume it is there, which keeps them short.
- A boundary inside the remote stops the shell's panel fallback from covering an app that has already loaded.
- Keeping the other team's data optional is what makes T7.4 pass.
- Each widget that reads the other team's data needs its own degraded state, cleared when the realtime connection returns ([ADR 039](039-realtime-into-the-cache.md)).
