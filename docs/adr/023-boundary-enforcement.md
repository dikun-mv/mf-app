# ADR 023: Boundary enforcement (D23)

Status: accepted

## Decision

dependency-cruiser, run as `pnpm lint:deps` inside `pnpm lint`, configured in `.dependency-cruiser.cjs` at the repo root. It enforces the rules below over the whole import graph, including type-only imports and cycles, and will generate the dependency diagram for the README. Rslint handles code-level rules (ADR 024).

## Alternative

`eslint-plugin-boundaries`: editor feedback as you type, but per-file only. Cycles need another plugin, type-only handling depends on version, and pnpm workspace resolution needs extra resolver setup.

## Why

The brief scores whether the remotes are "genuinely independent or quietly coupled". Whole-graph rules plus a generated diagram show that independence directly: Delivery reaches People only through `people-contract`. Cost: no squiggles in the editor; violations show up when `pnpm lint` runs.

## Ownership, by path

- **People team:** `apps/people`, `services/people-api`, `packages/people-domain`, `packages/people-contract`
- **Delivery team:** `apps/delivery`, `services/delivery-api`, `packages/delivery-domain`, `packages/delivery-contract`
- **Platform:** `apps/shell`, `packages/ui`, `packages/host-contract`

## Rules (all severity `error`)

| Rule                                           | Forbids                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `no-cross-app`                                 | An app importing another app                                                                                        |
| `no-cross-team-internals-people` / `-delivery` | A team importing the other team's app, service or domain. Only `*-contract` packages and `ui` cross team lines      |
| `shell-no-team-internals`                      | The shell importing any team app, service or domain package                                                         |
| `app-to-own-service-types-only`                | An app importing a service at runtime; only `import type` (Hono's typed client) is allowed                          |
| `contracts-are-leaves`                         | A `*-contract` package importing anything but `zod` and other contract packages (its own tests are exempt, ADR 028) |
| `domain-is-framework-free`                     | A `*-domain` package importing react, ui, an app or a service                                                       |
| `services-no-ui`                               | A service importing an app or `ui`                                                                                  |
| `ui-deps`                                      | `ui` importing any workspace package or any npm package except react, react-dom and clsx                            |
| `no-circular`                                  | Import cycles                                                                                                       |
| `not-to-unresolvable`                          | Imports that don't resolve                                                                                          |

## Verified in Phase 0

`.dependency-cruiser.test.ts` builds a temporary repo with the same layout, linked through `node_modules` symlinks the way pnpm links workspace packages. A clean baseline, which includes the allowed cross-team imports (Delivery to `people-contract`, both apps to `ui`, an app's type-only import of its own service), must pass. Each rule is then violated in at least one way (19 cases) and must make the real `depcruise` CLI exit non-zero naming that rule.

Writing this test caught a real typo in `shell-no-team-internals`, which would have let the shell import a service.

## Notes

- depcruise reports one rule per dependency, so a violating import that matches several rules shows only one name. The fixtures use imports that match exactly one rule.
- `pnpm lint:deps` scans `apps`, `packages` and `services`. Those folders hold a `.gitkeep` until real packages exist.
- Needs TypeScript 6 (ADR 026).
