# ADR 024: Code linter (D24)

Status: accepted

## Decision

Rslint, run as `pnpm lint:code` inside `pnpm lint`, with built-in plugins only: `@typescript-eslint` (the `strictTypeChecked` set, with `no-explicit-any` and the `no-unsafe-*` family set to `error`), `react-hooks` (`rules-of-hooks`, `exhaustive-deps`), `rstest` (test files) and `jsx-a11y` (`.tsx`). Type information comes from `parserOptions.projectService`, so each workspace package is checked against its own `tsconfig.json`. No `import` rules (dependency-cruiser owns the boundaries) and no formatting rules (Prettier formats). Config: `rslint.config.ts`.

## Alternative

ESLint with flat config, typescript-eslint, `eslint-plugin-react-hooks` and `eslint-config-prettier`. Switching means rewriting the `plugins` entry into ESLint's object form and installing the plugin packages; the rule selections stay the same.

## Why

One toolchain family across build, test and lint. Type-aware linting is built in through the Go TypeScript compiler, and it's fast. Cost: younger than ESLint.

## Verified in T0.2 (Rslint 0.9.4)

Two throwaway workspace packages, where one depended on the other through `workspace:^`, plus a React package, all with deliberately bad code. Every rule fired, and then the packages were removed:

- `no-explicit-any` inside a workspace package.
- `no-unsafe-member-access` and `no-unsafe-assignment` on a value whose `any` type came through the workspace link. This shows type information crosses pnpm's workspace links.
- `react-hooks/rules-of-hooks` on a conditional hook.
- `react-hooks/exhaustive-deps` on a missing effect dependency.
- `jsx-a11y/alt-text`.

Not verified: that the Rslint VS Code extension shows the same errors in the editor. That needs an interactive editor session.

The ESLint fallback was not needed.

## Amended 2026-10-08

T8.3 adds `@typescript-eslint/switch-exhaustiveness-check` with `considerDefaultExhaustiveForUnions` and `requireDefaultForNonUnion`. A `switch` over a union must name every member or say in a `default` what the rest get. That also catches switches that return nothing, where a missing case would otherwise compile. Verified by deleting a case from People's `patchCollection`: the rule names the unmatched member.
