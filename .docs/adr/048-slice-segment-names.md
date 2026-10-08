# ADR 048: Slice segments are `components`, `hooks`, `api` and `lib` (amends D28)

Status: accepted (2026-10-08, after Phase 7). Amends [ADR 038](038-feature-sliced-design.md).

## Context

[ADR 038](038-feature-sliced-design.md) took FSD's segment names for the inside of a slice: `ui`, `model`, `api`, `lib`. In these apps the `model` folders hold React hooks (`useRateRecords`, `useGridView`, the `GridActions` provider) and, in two places, plain logic (`pendingRows.ts`, `rateForm.ts`), so the name says little about what is inside. `ui` also clashes with the workspace package `packages/ui`, whose own folder is `src/components/`.

## Decision

- **The segments inside a slice are:**
  - `components`: React components and their CSS Modules.
  - `hooks`: React hooks, including a context provider whose purpose is its hooks (`GridActions.tsx`).
  - `api`: calls to the outside, as before.
  - `lib`: plain logic and helpers that aren't hooks (`pendingRows.ts`, `rateForm.ts`).
- **An app's `shared/ui` becomes `shared/components`.** The layers, slices and the public `index.ts` of each slice don't change.
- **`@baseline/ui` is not touched.** It is the workspace package, not a segment.
- **The dependency-cruiser rules don't change,** because they never name segments: they look at layers, slices and `index.ts` files.

## Alternatives

- **Keep FSD's `ui` and `model`.** Standard names, but `model` holds hooks and not a model, and `ui` repeats the package name.

## Consequences

- A folder name says what is inside it, and the apps' `components/` matches `packages/ui/src/components/`.
- A departure from standard FSD segment names (`ui`, `model`): a reader who knows FSD has to map `components` to `ui` and `hooks` to `model`. The plan and ADR 038 point here for that.
- The move was mechanical: `pendingRows` and `rateForm` went from `model` to `lib`, then every `model` folder became `hooks` and every `ui` folder `components`, with relative imports rewritten and no change to behaviour.
