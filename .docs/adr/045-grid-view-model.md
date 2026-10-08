# ADR 045: The grid view model is a pure function (D35)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 019](019-rounding-scheme.md) and [ADR 036](036-server-state.md).

## Context

The staffing grid shows rows, exact and rounded values, cell states, markers and the content of the cell-details panel. Rounding is controlled across the whole grid (D19), so a value can't be computed cell by cell. The brief looks hardest at the domain, and the grid has about 720 cells that must not all re-render on each rate or allocation event.

## Decision

- **A pure `gridView(plan, people, projectId, unit, currency)` in `delivery-domain`**, built on the existing `buildGrid` layout, `rollUp` and `roundGrid`, returns everything the grid shows: rows, exact and displayed values from `roundGrid`, cell states and markers.
- `widgets/staffing-grid/model` only reads the cached collections and memoises it: per-cell exact values by the `(allocation, employee's rates)` references, and `roundGrid` by `(project, unit, currency, input references)`.
- Patched caches keep unchanged records' references ([ADR 036](036-server-state.md), [ADR 039](039-realtime-into-the-cache.md)), so a rate event recomputes only that employee's cells before re-rounding.
- Rows are `React.memo` components with primitive props and a stable callback per row.

## Alternatives

- **Deriving inside each `GridCell`.** Rounding needs the whole grid.
- **A `select` per query.** It can't combine queries.
- **A derived-data store.** It is a global store ([ADR 041](041-client-state.md)).

## Consequences

- Everything the grid shows is calculated without mounting React, where the brief looks hardest, and tested in the domain project with its coverage.
- T6.11's memoisation follows from it.
- `roundGrid` reruns for the whole open project after any change, which is cheap at this size (D19).
- The function also works without People's data: PM and % only, employee ids as names ([ADR 042](042-loading.md)).

_Names as built: since [ADR 048](048-slice-segment-names.md) (2026-10-08) the memoising code is in `widgets/staffing-grid/hooks` (`useGridView`), and the cell the plan calls `GridCell` is `EditableCell` in `features/edit-cell` (T6.6), rendered by the `React.memo` rows in `GridRows.tsx`._
