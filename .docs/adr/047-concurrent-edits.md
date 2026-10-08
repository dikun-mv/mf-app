# ADR 047: Last write wins; drafts are not overwritten (D37)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 039](039-realtime-into-the-cache.md).

## Context

Several tabs and users can edit the same data, and realtime events change the cache while someone is typing ([ADR 039](039-realtime-into-the-cache.md)). The brief doesn't ask for conflict handling, and a version check would need server code, which D4 keeps out of the server.

## Decision

- **Last write wins**, across tabs and users.
- **While a cell or form is being edited, realtime changes update the cache but not the draft:** the input keeps what the user typed, and the new stored value shows after save or cancel.
- **"An unchanged value causes no write" (T6.6)** compares the draft with the stored value **at save time**.
- **A form whose record is deleted underneath it** says "this record was removed" and disables submit.

## Alternatives

- **Optimistic locking with a version field.** It needs a server-side check, which D4 keeps off the server.
- **Merging edits.**

## Consequences

- Nothing is lost silently: the other edit shows as soon as the draft closes.
- When two people edit the same cell at once, the later save wins. The README lists it as a known limitation (T9.2).
