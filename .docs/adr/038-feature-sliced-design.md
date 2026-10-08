# ADR 038: Feature-Sliced Design in each app (D28)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Extends [ADR 023](023-boundary-enforcement.md).

## Context

Each app started with a flat `screens/`, `routing/` and `host/`. Phases 4–6 add dozens of files per app (query hooks, forms, a grid and its actions). The brief scores consistency across the three apps and a clear walkthrough, so the structure needs one convention, and its import rules need to be checkable like the team boundaries of ADR 023.

## Decision

**Feature-Sliced Design (v2.1) inside each of the three apps, with the same layer names in all three:**

- `app/`: bootstrap, `mount`, `App`, router, providers.
- `pages/`: one slice per route.
- `widgets/`: e.g. shell `top-bar`, `remote-panel`, `status-strip`; People `employee-register`, `employee-profile`, `rate-history`; Delivery `project-list`, `staffing-grid`, `cell-details`. The WBS tree is the grid's first column, not a widget of its own.
- `features/`: user actions, e.g. shell `switch-currency`, `pick-user`; People `search-employees`, `add-rate`, `correct-rate`, `remove-rate`; Delivery `switch-unit`, `edit-cell`, `add-item`, `rename-item`, `move-item`, `delete-item`, `assign-person`.
- `entities/`: `employee`, `rate-record`, `employee-month-load`, `project`, `breakdown-item`, `allocation` (query hooks and small entity UI).
- `shared/`: `api` (PocketBase clients, repository, query keys, `useApplyChangeSet`, error mapping), `lib`, `config`, `testing`.

Segments inside a slice: `ui`, `model`, `api`, `lib`. **The domain packages stay outside FSD:** entities hold no business rules and call `*-domain`. `packages/ui` holds the generic primitives; an app's own `shared/ui` holds only app-specific pieces that several slices use (e.g. the not-found view). A layer, slice or segment is created only with its first file. **Relative imports, no `@/` alias.**

**Enforced by dependency-cruiser** (D23) with three new rules: `fsd-layers-import-down` (app → pages → widgets → features → entities → shared; a layer imports only layers below it), `fsd-no-cross-slice` (slices of one layer don't import each other, and there are no `@x` cross-imports: entities are combined in features and widgets) and `fsd-public-api` (code outside a slice imports it only through its `index.ts`).

## Alternatives

- **The flat `screens/`, `routing/`, `host/` per app; FSD checked by Steiger; FSD with `@x` entity cross-imports.** The flat layout gives no rule for where a change goes. Steiger is another tool next to dependency-cruiser. `@x` imports loosen the slice rule.

## Consequences

- One structure in all three apps; you know where a change goes before opening a file. "What may this import" becomes checkable, in the same tool and diagram as the team boundaries.
- No alias, because dependency-cruiser resolves with the one root `tsConfig`, and three apps would each need their own `@/`.
- More folders than an app of this size strictly needs; creating them only with their first file keeps them from becoming scaffolding. T4.0c restructures the existing code.
