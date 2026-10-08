# ADR 012: Shared UI primitives (D12)

Status: accepted

## Decision

`packages/ui`, owned by the platform team: a workspace dependency that each app bundles at build time, with React as a `peerDependency`, compiled from source by each app's Rsbuild. It is presentational only, imports nothing but React and `clsx`, and keeps no React context or global state.

## Alternatives

The shell exposes `shell/ui` through MF; `@baseline/ui` in MF `shared` as non-singleton.

## Why

Standalone keeps working, and the shell can't push a breaking UI change into a running remote, because changes arrive only when a team rebuilds. The duplicated copy costs a few KB. Runtime MF dedupe can come later if needed.
