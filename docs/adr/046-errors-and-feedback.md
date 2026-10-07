# ADR 046: One place for each kind of error (D33)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 036](036-server-state.md) and [ADR 042](042-loading.md).

## Context

A write can fail in three ways (the domain refuses it before sending, the server reports a conflict, the network or server fails), and a page's load can fail. A user also needs to see what an action did ("3 allocations moved to …"). Without a rule, each screen invents its own placement and wording.

## Decision

- **A `DomainError` refused before sending** shows next to its field or cell (`InlineMessage`).
- **A server `conflict`** refetches the affected collections and says the data changed.
- **A network or 5xx failure on a write** rolls back ([ADR 036](036-server-state.md)) and shows an `InlineMessage` at the top of the widget. The plan has no separate `Banner`.
- **A failed load** goes to the page boundary ([ADR 042](042-loading.md)).
- **Results of an action** ("3 allocations moved to …", D9; "deleted 2 items and 14 allocations") go to the widget's `role="status"` region (`StatusMessage`), which keeps the last message until the next action. No toasts.
- **One function per app, `describeError(error) → string`,** turns codes into text.
- **Retries:** queries 1, mutations 0.

## Alternatives

- **Toasts** (a new `ui` primitive with timing, stacking and focus rules), or **`alert()`.** Both put the message away from what caused it.

## Consequences

- Messages appear next to what caused them, and screen readers announce them through `role="status"`.
- Mutations aren't retried: a retried batch could clash with its own first attempt on client-generated ids, and the user can simply repeat the edit.
- One `describeError` keeps the wording consistent and testable.
