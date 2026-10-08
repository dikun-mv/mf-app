# ADR 013: Styling (D13)

Status: accepted

## Decision

CSS Modules (built into Rsbuild) with `clsx` for conditional classes. Design tokens are CSS custom properties scoped to `[data-baseline-root]`. Class names are typed with `@rsbuild/plugin-typed-css-modules`, and state-to-class maps are typed against the domain unions. Each app prefixes its class names (`bl-shell-`, `bl-people-`, `bl-delivery-`) through `output.cssModules.localIdentName`.

## Alternatives

Linaria; vanilla-extract; runtime CSS-in-JS.

## Why

Static CSS with no runtime style injection, no extra MF singleton and no Babel transform. Plain CSS is easy to edit in the live walkthrough, and Rstest uses the same CSS settings through the shared Rsbuild config. Cost: token names aren't typed.

## Verified in Phase 0

In a scratch project, two apps with different `localIdentName` prefixes each rendered their component under Rstest with their own prefix (`bl-a-primary-...`, `bl-b-primary-...`). Typed `.d.ts` generation is checked in T2.8.

_Checked in T2.8 (2026-10-06, [ADR 030](030-module-federation-skeleton.md)): the plugin generates a `.d.ts` per `*.module.css` a build reaches, the files are committed, and a class-name typo fails `tsc`._
